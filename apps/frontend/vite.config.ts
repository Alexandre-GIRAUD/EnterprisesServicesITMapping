import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

/**
 * Dev proxy: backend Spring Boot uses context-path /api.
 * Docker Compose maps the backend to host port 8081 by default (8080 often busy).
 * Override: VITE_API_PROXY_TARGET=http://127.0.0.1:8080 npm run dev
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget =
    env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8081';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
