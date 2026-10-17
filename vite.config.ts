/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
  plugins: [react()],
  server: {
    port: 5173,
    proxy: env.VITE_API_PROXY_TARGET ? {
      '/api': { target: env.VITE_API_PROXY_TARGET, changeOrigin: true },
      '/ws': { target: env.VITE_API_PROXY_TARGET, changeOrigin: true, ws: true },
    } : undefined,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
};
});
