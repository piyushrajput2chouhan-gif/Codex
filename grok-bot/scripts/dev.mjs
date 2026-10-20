import { createServer as createViteServer } from 'vite';
import { createServer } from '../server/index.mjs';

const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index < 0 ? fallback : args[index + 1];
};
const backend = createServer();
try {
  await new Promise((resolve, reject) => {
    backend.server.once('error', reject);
    backend.server.listen(3001, '127.0.0.1', resolve);
  });
} catch (error) {
  await backend.close();
  console.error(`Cannot start the task API on port 3001: ${error.message}`);
  process.exit(1);
}
const vite = await createViteServer({
  server: {
    host: value('--host', '0.0.0.0'),
    port: Number(value('--port', 4173)),
    strictPort: args.includes('--strictPort'),
  },
});
try {
  await vite.listen();
  vite.printUrls();
} catch (error) {
  await vite.close();
  backend.server.close();
  await backend.close();
  console.error(error.message);
  process.exit(1);
}
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
  if (stopping) return;
  stopping = true;
  await vite.close();
  backend.server.close();
  await backend.close();
});
