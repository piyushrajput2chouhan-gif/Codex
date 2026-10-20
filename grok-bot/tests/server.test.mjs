import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { createServer, createStore, createApplication } from '../server/index.mjs';
import { validateServerEnvironment } from '../server/environment.mjs';
import { checkAI } from '../scripts/check-ai.mjs';

const provider = { AI_API_KEY: `fixture-${randomUUID()}`, AI_BASE_URL: 'https://provider.example.test/custom/v1/', AI_MODEL: 'fixture-model' };
const answer = (text = 'Fixture result') => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });

test('server requires an injected strong password and a Railway persistent volume', () => {
  for (const APP_PASSWORD of [undefined, '', 'short']) assert.throws(() => validateServerEnvironment({ APP_PASSWORD }), /APP_PASSWORD is required/);
  const APP_PASSWORD = randomUUID();
  assert.doesNotThrow(() => validateServerEnvironment({ APP_PASSWORD }));
  assert.throws(() => validateServerEnvironment({ APP_PASSWORD, RAILWAY_ENVIRONMENT_ID: 'test' }), /persistent Railway volume/);
  assert.throws(() => validateServerEnvironment({ APP_PASSWORD, RAILWAY_ENVIRONMENT_ID: 'test', RAILWAY_VOLUME_MOUNT_PATH: '/wrong', DATA_DIR: '/wrong' }), /DATA_DIR must match/);
  assert.doesNotThrow(() => validateServerEnvironment({ APP_PASSWORD, RAILWAY_ENVIRONMENT_ID: 'test', RAILWAY_VOLUME_MOUNT_PATH: '/app/data', DATA_DIR: '/app/data' }));
});

test('readiness gate requires actual provider success and exposes no credential or model output', async () => {
  let calls = 0;
  const fetch = async () => { calls++; return answer('READY'); };
  await assert.rejects(checkAI({ env: {}, fetch }), /Missing environment setting/);
  assert.equal(calls, 0);
  assert.deepEqual(await checkAI({ env: provider, fetch }), { ready: true });
  assert.equal(calls, 1);
  await assert.rejects(checkAI({ env: provider, fetch: async () => new Response('{}', { status: 401 }) }), /HTTP 401/);
  await assert.rejects(checkAI({ env: provider, fetch: async () => { throw new Error(`Failure ${provider.AI_API_KEY}`); } }), (error) => error.message.includes('[redacted]') && !error.message.includes(provider.AI_API_KEY));
});

async function setup(t, options = {}) {
  const temp = mkdtempSync(path.join(tmpdir(), 'task-server-'));
  const password = randomUUID();
  const app = createServer({ databasePath: path.join(temp, 'state.sqlite'), startScheduler: false, logErrors: false, ...options, env: { APP_PASSWORD: password, ...(options.env || {}) } });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const login = await fetch(`${base}/login`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ password }), redirect: 'manual' });
  assert.equal(login.status, 303);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  t.after(async () => { await app.close(); await new Promise((resolve) => app.server.close(resolve)); rmSync(temp, { recursive: true, force: true }); });
  async function request(route, method = 'GET', body, headers = {}) {
    const response = await fetch(`${base}${route}`, { method, headers: { Cookie: cookie, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  const save = async (body = {}) => {
    const result = await request('/api/tasks', 'POST', { title: 'Research brief', prompt: 'Write a useful brief', ...body });
    assert.equal(result.status, 201);
    return result.body;
  };
  return { ...app, request, save, temp, base, cookie };
}

test('HTTP CRUD validates input, persists to SQLite and cascades run deletion', async (t) => {
  const app = await setup(t);
  const task = await app.save();
  assert.equal(task.nextRunAt, null);
  assert.equal(task.enabled, true);
  assert.deepEqual((await app.request('/api/tasks')).body.tasks, [task]);
  const edited = await app.request(`/api/tasks/${task.id}`, 'PATCH', { title: 'Updated' });
  assert.equal(edited.body.title, 'Updated');
  const reopened = createStore(path.join(app.temp, 'state.sqlite'));
  assert.equal(reopened.task(task.id).title, 'Updated');
  reopened.close();
  app.runTask(task.id);
  await app.waitForIdle();
  assert.equal(app.store.runs(task.id).length, 1);
  assert.equal((await app.request(`/api/tasks/${task.id}`, 'DELETE')).status, 200);
  assert.equal(app.store.runs().length, 0);
  assert.equal((await app.request(`/api/tasks/${task.id}`, 'PATCH', { title: 'Gone' })).status, 404);
  for (const invalid of [{ title: '' }, { schedule: 'minutely' }, { schedule: null }, { enabled: null }, { enabled: 'true' }, { scheduledAt: '1' }, { unexpected: 'x' }, { prompt: 'x'.repeat(20_001) }]) {
    assert.equal((await app.request('/api/tasks', 'POST', { title: 'Task', prompt: 'Prompt', ...invalid })).status, 400);
  }
});

test('missing provider produces actionable saved failure and status exposes no secrets', async (t) => {
  const app = await setup(t);
  const task = await app.save();
  assert.equal((await app.request(`/api/tasks/${task.id}/run`, 'POST')).status, 202);
  await app.waitForIdle();
  const run = (await app.request(`/api/runs?taskId=${task.id}`)).body.runs[0];
  assert.equal(run.status, 'failed');
  assert.match(run.error, /AI_API_KEY, AI_BASE_URL, and AI_MODEL/);
  assert.equal(run.output, '');
  assert.ok(run.finishedAt);
  const status = (await app.request('/api/status')).body;
  assert.equal(status.providerConfigured, false);
  assert.equal(status.requiresRunningServer, true);
});

test('provider request yields saved output, blocks overlap and does not consume future schedule', async (t) => {
  let finish;
  let requested;
  const now = Date.parse('2026-10-18T12:00:00Z');
  const app = await setup(t, { now: () => now, env: provider, fetch: async (url, options) => {
    requested = { url, options };
    return await new Promise((resolve) => { finish = resolve; });
  } });
  const task = await app.save({ schedule: 'once', scheduledAt: '2026-10-19T12:00:00Z' });
  app.runTask(task.id);
  await Promise.resolve();
  assert.equal((await app.request(`/api/tasks/${task.id}/run`, 'POST')).status, 409);
  assert.equal((await app.request(`/api/tasks/${task.id}`, 'DELETE')).status, 409);
  finish(answer('The completed brief'));
  await app.waitForIdle();
  assert.equal(requested.url, 'https://provider.example.test/custom/v1/chat/completions');
  assert.equal(requested.options.headers.Authorization, `Bearer ${provider.AI_API_KEY}`);
  assert.equal(JSON.parse(requested.options.body).model, provider.AI_MODEL);
  assert.match(JSON.parse(requested.options.body).messages[0].content, /no browser/);
  assert.equal(app.store.runs(task.id)[0].output, 'The completed brief');
  assert.equal(app.store.task(task.id).nextRunAt, task.nextRunAt);
  assert.ok(!JSON.stringify((await app.request('/api/status')).body).includes(provider.AI_API_KEY));
});

test('all three provider environment variables are required without fallback values', async (t) => {
  for (const missing of ['AI_API_KEY', 'AI_BASE_URL', 'AI_MODEL']) for (const value of ['', '   ']) {
    let calls = 0;
    const app = await setup(t, { env: { ...provider, [missing]: value }, fetch: async () => { calls++; return answer(); } });
    assert.equal((await app.request('/api/status')).body.providerConfigured, false);
    const task = await app.save();
    app.runTask(task.id);
    await app.waitForIdle();
    assert.equal(calls, 0);
    assert.equal(app.store.runs(task.id)[0].status, 'failed');
    assert.match(app.store.runs(task.id)[0].error, /AI_API_KEY, AI_BASE_URL, and AI_MODEL/);
  }
});

test('NVIDIA uses the configured URL and model while keeping the environment key server-side', async (t) => {
  const env = { ...provider, AI_BASE_URL: 'https://integrate.api.nvidia.com/v1', AI_MODEL: 'meta/llama-3.3-70b-instruct' };
  let requested;
  const app = await setup(t, { env, fetch: async (url, options) => {
    requested = { url, options };
    return answer('NVIDIA adapter fixture result');
  } });
  const task = await app.save();
  app.runTask(task.id);
  await app.waitForIdle();
  assert.equal(requested.url, 'https://integrate.api.nvidia.com/v1/chat/completions');
  assert.equal(requested.options.headers.Authorization, `Bearer ${env.AI_API_KEY}`);
  assert.equal(requested.options.redirect, 'error');
  assert.equal(JSON.parse(requested.options.body).model, 'meta/llama-3.3-70b-instruct');
  assert.ok(!requested.options.body.includes(env.AI_API_KEY));
  const status = (await app.request('/api/status')).body;
  assert.equal(status.providerConfigured, true);
  assert.equal(status.model, env.AI_MODEL);
  assert.ok(!JSON.stringify(status).includes(env.AI_API_KEY));
  const runs = (await app.request('/api/runs')).body.runs;
  assert.equal(runs[0].status, 'succeeded');
  assert.ok(!JSON.stringify(runs).includes(env.AI_API_KEY));
});

test('due recurring task runs once after downtime and advances to the original cadence', async (t) => {
  let clock = Date.parse('2026-10-18T12:30:00Z');
  let calls = 0;
  const app = await setup(t, { now: () => clock, env: provider, fetch: async () => { calls++; return answer(); } });
  const task = await app.save({ schedule: 'hourly', scheduledAt: '2026-10-18T09:00:00Z' });
  app.tick();
  app.tick();
  await app.waitForIdle();
  assert.equal(calls, 1);
  assert.equal(app.store.task(task.id).nextRunAt, '2026-10-18T13:00:00.000Z');
  app.tick();
  await app.waitForIdle();
  assert.equal(calls, 1);
  clock = Date.parse('2026-10-18T13:00:00Z');
  app.tick();
  await app.waitForIdle();
  assert.equal(calls, 2);
  assert.equal(app.store.task(task.id).nextRunAt, '2026-10-18T14:00:00.000Z');
});

test('pause prevents scheduling and resume re-enables future runs; once runs stay completed', async (t) => {
  let clock = Date.parse('2026-10-18T12:00:00Z');
  const app = await setup(t, { now: () => clock, env: provider, fetch: async () => answer() });
  const task = await app.save({ scheduledAt: '2026-10-18T13:00:00Z' });
  await app.request(`/api/tasks/${task.id}`, 'PATCH', { enabled: false });
  clock = Date.parse('2026-10-18T14:00:00Z');
  app.tick();
  assert.equal(app.store.runs().length, 0);
  await app.request(`/api/tasks/${task.id}`, 'PATCH', { enabled: true });
  app.tick();
  await app.waitForIdle();
  assert.equal(app.store.runs().length, 1);
  assert.equal(app.store.task(task.id).nextRunAt, null);
  await app.request(`/api/tasks/${task.id}`, 'PATCH', { enabled: false });
  await app.request(`/api/tasks/${task.id}`, 'PATCH', { enabled: true });
  app.tick();
  await app.waitForIdle();
  assert.equal(app.store.runs().length, 1);
});

test('changing recurring cadence without a fixed start resets its next interval', async (t) => {
  const clock = Date.parse('2026-10-18T12:00:00Z');
  const app = await setup(t, { now: () => clock });
  const task = await app.save({ schedule: 'hourly' });
  assert.equal(task.nextRunAt, '2026-10-18T13:00:00.000Z');
  const updated = await app.request(`/api/tasks/${task.id}`, 'PATCH', { schedule: 'daily' });
  assert.equal(updated.body.nextRunAt, '2026-10-19T12:00:00.000Z');
});

test('restart marks every interrupted run failed and resumes persisted overdue schedules', async (t) => {
  const temp = mkdtempSync(path.join(tmpdir(), 'task-restart-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const filename = path.join(temp, 'state.sqlite');
  const store = createStore(filename);
  const stamp = '2026-10-18T09:00:00.000Z';
  store.putTask({ id: 'saved', title: 'Saved', prompt: 'Do task', schedule: 'daily', scheduledAt: stamp, enabled: true, createdAt: stamp, updatedAt: stamp, lastRunAt: null, nextRunAt: stamp });
  for (let index = 0; index < 205; index++) store.putRun({ id: `run-${index}`, taskId: 'saved', status: 'running', output: '', error: null, startedAt: stamp, finishedAt: null });
  store.close();
  const app = createApplication({ databasePath: filename, env: provider, fetch: async () => answer(), startScheduler: false, now: () => Date.parse('2026-10-18T12:00:00Z') });
  t.after(() => app.close());
  assert.equal(app.store.interruptedRuns().length, 0);
  assert.match(app.store.runs()[0].error, /restart/);
  app.tick();
  await app.waitForIdle();
  assert.equal(app.store.runs()[0].status, 'succeeded');
  assert.equal(app.store.task('saved').nextRunAt, '2026-10-19T09:00:00.000Z');
});

test('provider failures redact secrets and never fabricate output', async (t) => {
  const app = await setup(t, { env: provider, fetch: async () => { throw new Error(`Invalid key ${provider.AI_API_KEY}`); } });
  const task = await app.save();
  app.runTask(task.id);
  await app.waitForIdle();
  const run = app.store.runs()[0];
  assert.equal(run.status, 'failed');
  assert.equal(run.output, '');
  assert.match(run.error, /\[redacted\]/);
  assert.ok(!JSON.stringify(run).includes(provider.AI_API_KEY));
});

test('cross-origin writes rejected and frontend files served from configured dist', async (t) => {
  const dist = mkdtempSync(path.join(tmpdir(), 'task-dist-'));
  t.after(() => rmSync(dist, { recursive: true, force: true }));
  mkdirSync(path.join(dist, 'assets'));
  writeFileSync(path.join(dist, 'index.html'), '<html>Task UI</html>');
  writeFileSync(path.join(dist, 'assets', 'app.js'), 'console.log("task")');
  const app = await setup(t, { distPath: dist });
  const task = await app.save();
  assert.equal((await app.request(`/api/tasks/${task.id}`, 'DELETE', undefined, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await app.request(`/api/tasks/${task.id}/run`, 'POST', undefined, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  const asset = await fetch(`${app.base}/assets/app.js`, { headers: { Cookie: app.cookie } });
  assert.match(asset.headers.get('content-type'), /javascript/);
  assert.equal(await asset.text(), 'console.log("task")');
  assert.match(await (await fetch(`${app.base}/saved`, { headers: { Cookie: app.cookie } })).text(), /Task UI/);
});

test('host allowlist rejects DNS rebinding even when Origin matches Host', async (t) => {
  const app = await setup(t);
  // Node fetch controls Host itself; use the HTTP client to exercise hostile headers.
  const requestHost = (base, route, headers) => new Promise((resolve, reject) => {
    const req = http.get(`${base}${route}`, { headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    req.on('error', reject);
  });
  const rebinding = await requestHost(app.base, '/api/status', { Host: 'evil.example', Origin: 'http://evil.example' });
  assert.equal(rebinding.status, 403);
  assert.match(rebinding.body.error, /Untrusted request host/);
  assert.equal((await requestHost(app.base, '/api/status', { Cookie: app.cookie, Host: 'terminal.local:3001', Origin: 'http://terminal.local:3001' })).status, 200);
  assert.equal((await requestHost(app.base, '/', { Host: 'evil.example' })).status, 403);
  const proxy = await setup(t, { env: { APP_ALLOWED_HOSTS: 'tasks.example.com, demo.example.com' } });
  assert.equal((await requestHost(proxy.base, '/api/status', { Cookie: proxy.cookie, Host: 'tasks.example.com', Origin: 'https://tasks.example.com' })).status, 200);
  assert.equal((await requestHost(proxy.base, '/api/status', { Cookie: proxy.cookie, Host: 'tasks.example.com', Origin: 'https://evil.example' })).status, 403);
});

test('provider timeout is a saved error and invalid provider payload is rejected', async (t) => {
  const app = await setup(t, { env: provider, providerTimeoutMs: 15, fetch: async (_url, options) => await new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')))) });
  const task = await app.save();
  app.runTask(task.id);
  await app.waitForIdle();
  assert.match(app.store.runs()[0].error, /timed out/);
  const malformed = await setup(t, { env: provider, fetch: async () => new Response('not json') });
  const task2 = await malformed.save();
  malformed.runTask(task2.id);
  await malformed.waitForIdle();
  assert.match(malformed.store.runs()[0].error, /invalid JSON/);
});
