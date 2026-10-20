// Browser integration fixture only. Never used by npm start or npm run dev.
// Both instances use temporary SQLite databases; no real AI service is contacted.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer } from '../server/index.mjs';

const temporary = mkdtempSync(path.join(tmpdir(), 'orbit-browser-'));
const appPassword = process.env.APP_PASSWORD;
if (!appPassword) throw new Error('APP_PASSWORD must be supplied by the browser test runner.');
const output = 'Browser integration fixture: useful saved task output.\n\nThis text comes from a local test provider, never a live AI service.';
const instances = [
  [4181, { APP_PASSWORD: appPassword, AI_API_KEY: `fixture-${randomUUID()}`, AI_BASE_URL: 'https://provider.example.test/v1', AI_MODEL: 'browser-fixture-model' }],
  [4182, { APP_PASSWORD: appPassword }],
];
const apps = [];
for (const [port, env] of instances) {
  const app = createServer({
    databasePath: path.join(temporary, `${port}.sqlite`),
    env,
    fetch: async () => new Response(JSON.stringify({ choices: [{ message: { content: output } }] }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }),
  });
  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(port, '127.0.0.1', resolve);
  });
  apps.push(app);
}
console.log('Browser-only fixture ready on 4181 (local provider) and 4182 (unconfigured).');
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
  if (stopping) return;
  stopping = true;
  for (const app of apps) {
    app.server.closeAllConnections();
    await new Promise((resolve) => app.server.close(resolve));
    await app.close();
  }
  rmSync(temporary, { recursive: true, force: true });
  process.exit(0);
});
