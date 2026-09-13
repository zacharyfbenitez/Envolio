import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Separate from the chat.dev proxy configuration and deployed dist directory.
// This is a shell preview, NOT a backend-connected TestFlight release yet.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: [{ find: './PwaShell.jsx', replacement: fileURLToPath(new URL('./native/NativeShell.jsx', import.meta.url)) }] },
  base: '/',
  define: { 'import.meta.env.VITE_NATIVE_SHELL': JSON.stringify('true') },
  build: { outDir: 'dist-native' },
});
