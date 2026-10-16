import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'frame-manifest',
    configureServer(server) {
      const frameRoot = fileURLToPath(new URL('./public/frames', import.meta.url));
      server.watcher.add(frameRoot);
      let timer: ReturnType<typeof setTimeout>;
      const refresh = (file: string) => {
        if (!file.startsWith(frameRoot) || !/\.(jpe?g|png|webp)$/i.test(file)) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          try {
            execFileSync(process.execPath, ['scripts/prepare-frames.mjs']);
            server.ws.send({ type: 'full-reload' });
          } catch { server.config.logger.error('Frame scan failed. Check frame files and run npm run frames.'); }
        }, 350);
      };
      server.watcher.on('add', refresh).on('unlink', refresh).on('change', refresh);
      server.httpServer?.once('close', () => clearTimeout(timer));
    },
  }],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  optimizeDeps: { entries: ['index.html'] },
});
