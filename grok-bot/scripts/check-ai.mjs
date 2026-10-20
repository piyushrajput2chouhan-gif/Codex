import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApplication } from '../server/index.mjs';

export async function checkAI({ env = process.env, fetch: providerFetch } = {}) {
  const missing = ['AI_API_KEY', 'AI_BASE_URL', 'AI_MODEL'].filter((name) => typeof env[name] !== 'string' || !env[name].trim());
  if (missing.length) {
    throw new Error(`Missing environment setting(s): ${missing.join(', ')}. Apply the saved environment settings and restart the environment. AI_API_KEY must be injected as a secret, never stored in a file.`);
  }
  const app = createApplication({ databasePath: ':memory:', startScheduler: false, env, fetch: providerFetch, logErrors: false });
  try {
    const stamp = new Date().toISOString();
    const id = randomUUID();
    app.store.putTask({ id, title: 'AI readiness verification', prompt: 'Reply with the single word READY.', schedule: 'once', scheduledAt: null, enabled: true, createdAt: stamp, updatedAt: stamp, lastRunAt: null, nextRunAt: null });
    app.runTask(id);
    await app.waitForIdle();
    const run = app.store.runs(id)[0];
    if (run.status !== 'succeeded') throw new Error(run.error || 'AI readiness verification failed.');
    return { ready: true };
  } finally {
    await app.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await checkAI();
    // Do not print model output, request headers, or any environment values.
    console.log('AI readiness check passed: a real model response was received.');
  } catch (error) {
    const key = process.env.AI_API_KEY;
    const message = String(error.message).replaceAll(key || '\0', '[redacted]');
    console.error(`AI readiness check failed: ${message}`);
    process.exitCode = 2;
  }
}
