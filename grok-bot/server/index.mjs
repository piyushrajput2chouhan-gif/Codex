import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAuth, isTrustedHost } from './auth.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const intervals = { hourly: 3_600_000, daily: 86_400_000, weekly: 604_800_000 };
class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const iso = (value) => new Date(value).toISOString();

export function nextOccurrence(task, now = Date.now()) {
  if (!task.enabled) return null;
  if (task.schedule === 'once') return task.scheduledAt && (!task.lastRunAt || Date.parse(task.lastRunAt) < Date.parse(task.scheduledAt)) ? task.scheduledAt : null;
  const step = intervals[task.schedule];
  const anchor = task.scheduledAt || task.nextRunAt ? Date.parse(task.scheduledAt || task.nextRunAt) : now + step;
  return iso(anchor > now ? anchor : anchor + (Math.floor((now - anchor) / step) + 1) * step);
}

function validate(input, previous, now) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(400, 'Expected a task object.');
  const allowed = new Set(['title', 'prompt', 'schedule', 'scheduledAt', 'enabled']);
  for (const key of Object.keys(input)) if (!allowed.has(key)) throw new ApiError(400, `Unknown task field: ${key}`);
  if ('enabled' in input && typeof input.enabled !== 'boolean') throw new ApiError(400, 'enabled must be a boolean.');
  if ('schedule' in input && !['once', ...Object.keys(intervals)].includes(input.schedule)) throw new ApiError(400, 'Invalid schedule.');
  const task = { ...previous, ...input };
  for (const [field, max] of [['title', 160], ['prompt', 20_000]]) {
    if (typeof task[field] !== 'string' || !task[field].trim() || task[field].length > max) throw new ApiError(400, `${field} must contain 1–${max} characters.`);
    task[field] = task[field].trim();
  }
  task.schedule ??= 'once';
  task.enabled ??= true;
  task.scheduledAt ??= null;
  if (!['once', ...Object.keys(intervals)].includes(task.schedule)) throw new ApiError(400, 'Invalid schedule.');
  if (typeof task.enabled !== 'boolean') throw new ApiError(400, 'enabled must be a boolean.');
  if (task.scheduledAt !== null) {
    if (typeof task.scheduledAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(task.scheduledAt) || !Number.isFinite(Date.parse(task.scheduledAt))) throw new ApiError(400, 'scheduledAt must be an ISO date or null.');
    task.scheduledAt = iso(task.scheduledAt);
  }
  // Editing content alone preserves the existing occurrence, including overdue work.
  const changesSchedule = !previous || ['schedule', 'scheduledAt', 'enabled'].some((key) => key in input && input[key] !== previous[key]);
  if (changesSchedule) {
    if (previous && ('scheduledAt' in input || 'schedule' in input)) task.lastRunAt = null;
    if (previous && 'schedule' in input && input.schedule !== previous.schedule && !task.scheduledAt) task.nextRunAt = null;
    task.nextRunAt = task.enabled && task.scheduledAt && !task.lastRunAt ? task.scheduledAt : nextOccurrence(task, now);
  }
  return task;
}

export function createStore(filename = ':memory:') {
  if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, taskId TEXT NOT NULL, data TEXT NOT NULL,
      FOREIGN KEY(taskId) REFERENCES tasks(id) ON DELETE CASCADE);
    CREATE INDEX IF NOT EXISTS runs_taskId ON runs(taskId);`);
  const decode = (rows) => rows.map((row) => JSON.parse(row.data));
  const store = {
    db,
    tasks: () => decode(db.prepare('SELECT data FROM tasks ORDER BY rowid DESC').all()),
    task: (id) => { const row = db.prepare('SELECT data FROM tasks WHERE id=?').get(id); return row ? JSON.parse(row.data) : null; },
    putTask: (task) => { db.prepare('INSERT INTO tasks(id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(task.id, JSON.stringify(task)); return task; },
    deleteTask: (id) => db.prepare('DELETE FROM tasks WHERE id=?').run(id),
    runs: (taskId) => decode(taskId ? db.prepare('SELECT data FROM runs WHERE taskId=? ORDER BY rowid DESC LIMIT 200').all(taskId) : db.prepare('SELECT data FROM runs ORDER BY rowid DESC LIMIT 200').all()),
    interruptedRuns: () => decode(db.prepare("SELECT data FROM runs WHERE json_extract(data, '$.status')='running'").all()),
    putRun: (run) => { db.prepare('INSERT INTO runs(id,taskId,data) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(run.id, run.taskId, JSON.stringify(run)); return run; },
    close: () => db.close(),
  };
  return store;
}

export function createApplication(options = {}) {
  const now = options.now ?? Date.now;
  const env = options.env ?? process.env;
  const store = options.store ?? createStore(options.databasePath ?? path.join(env.DATA_DIR || path.join(root, 'data'), 'grok-bot.sqlite'));
  const providerConfigured = ['AI_API_KEY', 'AI_BASE_URL', 'AI_MODEL'].every((name) => typeof env[name] === 'string' && env[name].trim().length > 0);
  const active = new Map();
  let heartbeatAt = null;
  let closing = false;
  const controllers = new Set();
  // A process may have stopped during a request. Mark it interrupted, never claim success.
  for (const run of store.interruptedRuns()) {
    if (run.status === 'running') store.putRun({ ...run, status: 'failed', error: 'Execution interrupted by server restart. Run the task again.', finishedAt: iso(now()) });
  }
  const safeError = (message) => [env.AI_API_KEY, env.APP_PASSWORD].filter(Boolean).reduce((text, secret) => text.replaceAll(secret, '[redacted]'), String(message)).slice(0, 1000);

  async function execute(task) {
    if (closing) throw new Error('Execution interrupted by server shutdown. Run the task again.');
    if (!providerConfigured) throw new Error('AI provider is not configured. Set AI_API_KEY, AI_BASE_URL, and AI_MODEL on the server, then restart.');
    const base = new URL(env.AI_BASE_URL);
    if (base.username || base.password || base.search || base.hash) throw new Error('AI_BASE_URL must be a base URL without credentials, query, or fragment.');
    if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname))) throw new Error('AI_BASE_URL must use HTTPS (HTTP is allowed only for localhost).');
    const controller = new AbortController();
    controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), options.providerTimeoutMs ?? 120_000);
    try {
      const response = await (options.fetch ?? fetch)(`${base.href.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST', signal: controller.signal, redirect: 'error',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.AI_API_KEY}` },
        body: JSON.stringify({ model: env.AI_MODEL, messages: [{ role: 'system', content: 'Complete the user task accurately. You have no browser, external tools, or live data access. State limitations when the task needs those capabilities. Do not claim to have taken actions or retrieved live information.' }, { role: 'user', content: task.prompt }], stream: false }),
      });
      if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}. Check server credentials, model, quota, and provider availability.`);
      const reader = response.body?.getReader();
      let raw = '';
      if (reader) {
        let size = 0;
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 2_000_000) { await reader.cancel(); throw new Error('AI response exceeded the 2 MB limit.'); }
          raw += decoder.decode(value, { stream: true });
        }
        raw += decoder.decode();
      } else raw = await response.text();
      let data;
      try { data = JSON.parse(raw); } catch { throw new Error('AI provider returned invalid JSON.'); }
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) throw new Error('AI provider returned no text output.');
      return content;
    } catch (error) {
      if (controller.signal.aborted) throw new Error('AI request timed out or the server shut down. Try again.');
      throw error;
    } finally { clearTimeout(timeout); controllers.delete(controller); }
  }

  function runTask(id) {
    if (closing) throw new ApiError(503, 'Server is shutting down.');
    const task = store.task(id);
    if (!task) throw new ApiError(404, 'Task not found.');
    if (active.has(id)) throw new ApiError(409, 'This task is already running.');
    if (active.size >= 4) throw new ApiError(429, 'Four tasks are already running. Try again shortly.');
    const startedAt = iso(now());
    const run = store.putRun({ id: randomUUID(), taskId: id, status: 'running', output: '', error: null, startedAt, finishedAt: null });
    const updated = { ...task, lastRunAt: startedAt, updatedAt: startedAt };
    // Running early must not consume an already scheduled future occurrence.
    updated.nextRunAt = task.enabled && task.nextRunAt && Date.parse(task.nextRunAt) > now() ? task.nextRunAt : nextOccurrence(updated, now());
    store.putTask(updated);
    const pending = Promise.resolve().then(() => execute(task)).then(
      (output) => store.putRun({ ...run, status: 'succeeded', output, finishedAt: iso(now()) }),
      (error) => store.putRun({ ...run, status: 'failed', error: safeError(error.message), finishedAt: iso(now()) }),
    ).finally(() => active.delete(id));
    active.set(id, pending);
    return run;
  }

  function tick() {
    heartbeatAt = iso(now());
    for (const task of store.tasks()) {
      if (!task.enabled || !task.nextRunAt || Date.parse(task.nextRunAt) > now() || active.has(task.id) || active.size >= 4) continue;
      runTask(task.id);
    }
  }
  const timer = options.startScheduler === false ? null : setInterval(tick, options.tickMs ?? 1000);
  timer?.unref();
  if (options.startScheduler !== false) tick();

  const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(body)); };
  async function readJson(req) {
    if (!req.headers['content-type']?.startsWith('application/json')) throw new ApiError(415, 'Use application/json.');
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (Buffer.byteLength(body) > 64_000) throw new ApiError(413, 'Request body is too large.');
    }
    try { return JSON.parse(body); } catch { throw new ApiError(400, 'Invalid JSON.'); }
  }
  async function handler(req, res) {
    try {
      if (!isTrustedHost(req, env)) throw new ApiError(403, 'Untrusted request host. Configure APP_ALLOWED_HOSTS for a custom domain.');
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        // A same-origin local UI is the supported client. Block cross-site writes.
        const origin = req.headers.origin;
        if (origin) {
          let originHost;
          try { originHost = new URL(origin).host; } catch { throw new ApiError(403, 'Invalid request origin.'); }
          if (originHost !== req.headers.host) throw new ApiError(403, 'Cross-origin API access is disabled.');
        }
        if (req.headers['sec-fetch-site'] === 'cross-site') throw new ApiError(403, 'Cross-site API access is disabled.');
        if (req.method === 'GET' && ['/api/status', '/api/settings/status'].includes(url.pathname)) return json(res, 200, {
          providerConfigured, model: env.AI_MODEL || null, heartbeatAt, activeRuns: active.size,
          storage: 'sqlite', capabilities: ['saved-tasks', 'schedules', 'text-generation', 'saved-outputs'],
          executionMode: 'text-generation', requiresRunningServer: true,
        });
        if (req.method === 'GET' && url.pathname === '/api/tasks') return json(res, 200, { tasks: store.tasks() });
        if (req.method === 'POST' && url.pathname === '/api/tasks') {
          if (store.tasks().length >= 1000) throw new ApiError(400, 'Task limit reached (1000).');
          const stamp = iso(now());
          const task = { ...validate(await readJson(req), null, now()), id: randomUUID(), createdAt: stamp, updatedAt: stamp, lastRunAt: null };
          return json(res, 201, store.putTask(task));
        }
        if (req.method === 'GET' && url.pathname === '/api/runs') return json(res, 200, { runs: store.runs(url.searchParams.get('taskId')) });
        const match = url.pathname.match(/^\/api\/tasks\/([^/]+)(\/run)?$/);
        if (match) {
          const id = decodeURIComponent(match[1]);
          const task = store.task(id);
          if (!task) throw new ApiError(404, 'Task not found.');
          if (match[2] && req.method === 'POST') return json(res, 202, runTask(id));
          if (!match[2] && req.method === 'PATCH') {
            const updated = { ...validate(await readJson(req), task, now()), updatedAt: iso(now()) };
            return json(res, 200, store.putTask(updated));
          }
          if (!match[2] && req.method === 'DELETE') {
            if (active.has(id)) throw new ApiError(409, 'Wait for the running task before deleting it.');
            store.deleteTask(id);
            return json(res, 200, { deleted: true });
          }
        }
        throw new ApiError(404, 'API endpoint not found.');
      }
      if (!['GET', 'HEAD'].includes(req.method)) throw new ApiError(405, 'Method not allowed.');
      const dist = path.resolve(options.distPath ?? path.join(root, 'dist'));
      const decoded = decodeURIComponent(url.pathname);
      let file = path.resolve(dist, `.${decoded}`);
      if (!file.startsWith(`${dist}${path.sep}`) && file !== dist) throw new ApiError(403, 'Forbidden.');
      if (!existsSync(file) || !statSync(file).isFile()) file = path.join(dist, 'index.html');
      if (!existsSync(file)) return json(res, 503, { error: 'Frontend not built. Run npm run build or use the Vite development server.' });
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' });
      res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
    } catch (error) {
      json(res, error.status || 500, { error: error.status ? error.message : 'An internal error occurred. Check the server configuration.' });
      if (!error.status && options.logErrors !== false) console.error('[server]', safeError(error.message));
    }
  }
  async function close() {
    closing = true;
    if (timer) clearInterval(timer);
    for (const controller of controllers) controller.abort();
    await Promise.allSettled([...active.values()]);
    store.close();
  }
  return { handler, store, runTask, tick, close, waitForIdle: () => Promise.allSettled([...active.values()]) };
}

export function createServer(options = {}) {
  const auth = createAuth(options.env ?? process.env, { now: options.now ?? Date.now });
  const app = createApplication(options);
  const server = http.createServer((req, res) => {
    auth.handle(req, res, () => app.handler(req, res)).catch(() => {
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
      if (!res.writableEnded && !res.destroyed) res.end('{"error":"Request could not be completed."}');
    });
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  return { ...app, server };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createServer();
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 3001);
  app.server.listen(port, host, () => console.log(`Task server listening on http://${host}:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
    app.server.close();
    await app.close();
    app.server.closeAllConnections();
  });
}
