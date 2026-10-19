/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolveApiBase } from './src/shared/apiOrigin.ts';

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  // Validate deployable artifacts before compilation, including accidental local .env values.
  if (command === 'build') resolveApiBase(env.VITE_API_BASE_URL, false);
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
