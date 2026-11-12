import { defineConfig } from 'vite';

// base relative : le même build sert au web, à l'appli de bureau (Electron) et à Android (Capacitor)
export default defineConfig({
  base: './',
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1500, target: 'es2020' },
  server: { host: true },
});
