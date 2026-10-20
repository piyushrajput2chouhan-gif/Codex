import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createServer } from '../server/index.mjs';

async function setup(t, extra = {}) {
  const password = randomUUID();
  const dist = mkdtempSync(path.join(tmpdir(), 'orbit-auth-'));
  writeFileSync(path.join(dist, 'index.html'), '<html>Private workspace</html>');
  const app = createServer({ databasePath: ':memory:', distPath: dist, startScheduler: false, logErrors: false, ...extra, env: { APP_PASSWORD: password, ...(extra.env || {}) } });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  t.after(async () => { await app.close(); app.server.closeAllConnections(); await new Promise((resolve) => app.server.close(resolve)); rmSync(dist, { recursive: true, force: true }); });
  const request = (route, options = {}) => fetch(base + route, { redirect: 'manual', ...options });
  const login = (value = password, headers = {}) => request('/login', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams({ password: value }) });
  return { app, password, base, request, login };
}

test('startup refuses missing password before exposing an app or creating storage', () => {
  assert.throws(() => createServer({ env: {}, databasePath: ':memory:' }), /APP_PASSWORD is required/);
});

test('anonymous users see login only; APIs and assets reveal no workspace data', async (t) => {
  const s = await setup(t);
  assert.equal((await s.request('/')).status, 303);
  assert.equal((await s.request('/assets/app.js')).status, 303);
  assert.equal((await s.request('/api/tasks')).status, 401);
  assert.equal((await s.request('/api/status')).status, 401);
  assert.equal((await s.request('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
  const page = await s.request('/login');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Workspace password/);
  assert.equal((await s.request('/login', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 200);
  assert.equal((await s.request('/', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 303);
  const health = await s.request('/healthz');
  assert.deepEqual(await health.json(), { ok: true });
  const rawHealth = await new Promise((resolve, reject) => {
    http.get(s.base + '/healthz', { headers: { Host: 'healthcheck.railway.app' } }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); }).on('error', reject);
  });
  assert.equal(rawHealth, 200);
});

test('password login creates a private cookie; logout revokes it', async (t) => {
  const s = await setup(t);
  const failed = await s.login('incorrect');
  assert.equal(failed.status, 401);
  assert.equal(failed.headers.get('set-cookie'), null);
  const signedIn = await s.login();
  assert.equal(signedIn.status, 303);
  const cookieHeader = signedIn.headers.get('set-cookie');
  assert.match(cookieHeader, /HttpOnly/);
  assert.match(cookieHeader, /SameSite=Strict/);
  assert.ok(!cookieHeader.includes(s.password));
  const Cookie = cookieHeader.split(';')[0];
  const page = await s.request('/', { headers: { Cookie } });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Private workspace/);
  assert.equal((await s.request('/api/tasks', { headers: { Cookie } })).status, 200);
  const logout = await s.request('/logout', { method: 'POST', headers: { Cookie } });
  assert.equal(logout.status, 303);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await s.request('/api/tasks', { headers: { Cookie } })).status, 401);
});

test('Railway production sessions are Secure and do not trust arbitrary forwarded hosts', async (t) => {
  const s = await setup(t, { env: { NODE_ENV: 'production', RAILWAY_PUBLIC_DOMAIN: 'orbit-example.up.railway.app' } });
  assert.match((await s.login()).headers.get('set-cookie'), /; Secure/);
  assert.equal((await s.login(undefined, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await s.request('/logout', { method: 'POST', headers: { Origin: 'https://evil.example' } })).status, 403);
  const raw = await new Promise((resolve, reject) => {
    http.get(s.base + '/login', { headers: { Host: 'orbit-example.up.railway.app', 'X-Forwarded-Host': 'evil.example' } }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); }).on('error', reject);
  });
  assert.equal(raw, 200);
});

test('failed sign-ins are rate-limited and sessions expire without disk storage', async (t) => {
  let clock = Date.now();
  const s = await setup(t, { now: () => clock });
  for (let i = 0; i < 8; i++) assert.equal((await s.login('incorrect')).status, 401);
  assert.equal((await s.login()).status, 429);
  clock += 15 * 60 * 1000 + 1;
  const signedIn = await s.login();
  assert.equal(signedIn.status, 303);
  const Cookie = signedIn.headers.get('set-cookie').split(';')[0];
  assert.equal((await s.request('/api/tasks', { headers: { Cookie } })).status, 200);
  clock += 12 * 60 * 60 * 1000 + 1;
  assert.equal((await s.request('/api/tasks', { headers: { Cookie } })).status, 401);
});
