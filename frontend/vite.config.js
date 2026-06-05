import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],

    server: {
      host: '0.0.0.0',
      allowedHosts: true,
      port: 5173,

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