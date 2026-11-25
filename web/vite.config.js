import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// The website talks to the local API (src/server/start.js) through /api.
// It also imports the shared chart and data code from ../src, so that folder is
// allowed. Nothing here contacts any outside service.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
    proxy: { '/api': 'http://127.0.0.1:8787' },
    fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
  },
  preview: { port: 4173, host: '127.0.0.1', proxy: { '/api': 'http://127.0.0.1:8787' } },
  build: { outDir: 'dist', sourcemap: false },
});
