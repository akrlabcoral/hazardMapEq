import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],

    server: {
      port: 5173,

      // ── API Proxy ────────────────────────────────────────────────────────────
      // Forwards any request starting with /api from the React dev server
      // to the Express backend (port 5001), avoiding CORS issues during
      // local development. In production, nginx or a load balancer handles
      // this routing instead.
      proxy: {
        '/ml-api': {
          target: env.VITE_ML_API_URL || 'http://localhost:8000',
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/ml-api/, ''),
        },
        '/scientific-api': {
          target: env.VITE_SCIENTIFIC_API_URL || 'http://localhost:8000',
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/scientific-api/, '/api'),
        },
      },
    },
  };
});
