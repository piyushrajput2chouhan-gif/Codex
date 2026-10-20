import path from 'node:path';

// Configuration comes only from the process environment. No .env files are read.
export function validateServerEnvironment(env = process.env) {
  if (typeof env.APP_PASSWORD !== 'string' || env.APP_PASSWORD.trim().length < 16 || env.APP_PASSWORD.length > 1024) {
    throw new Error('APP_PASSWORD is required and must contain 16–1024 characters. Set it as an environment secret; never store it in a file.');
  }
  if (env.RAILWAY_ENVIRONMENT_ID && !env.RAILWAY_VOLUME_MOUNT_PATH) {
    throw new Error('Attach a persistent Railway volume mounted at /app/data before starting the app.');
  }
  if (env.RAILWAY_ENVIRONMENT_ID && (!env.DATA_DIR || path.resolve(env.DATA_DIR) !== '/app/data' || path.resolve(env.RAILWAY_VOLUME_MOUNT_PATH) !== '/app/data')) {
    throw new Error('DATA_DIR must match the Railway persistent volume mount path /app/data.');
  }
}
