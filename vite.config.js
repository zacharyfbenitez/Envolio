import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const publicBase = process.env.PUBLIC_BASE || '/p/bUpWZzvZpIOeEaBV-xsmW/5173/';
const proxyBaseAdapter = {
  name: 'chatdev-proxy-base-adapter',
  enforce: 'post',
  transformIndexHtml(html) {
    return html
      .replaceAll(`src="${publicBase}`, 'src="/')
      .replaceAll(`href="${publicBase}`, 'href="/');
  },
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url && !req.url.startsWith(publicBase) && !req.url.startsWith('/api/')) {
        req.url = `${publicBase.slice(0, -1)}${req.url}`;
      }
      next();
    });
  }
};

export default defineConfig({
  plugins: [proxyBaseAdapter, react()],
  base: publicBase,
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    hmr: false,
    proxy: {
      '/api': 'http://127.0.0.1:8787'
    }
  }
});
