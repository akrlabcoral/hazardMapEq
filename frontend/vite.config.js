import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],

    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          admin: resolve(__dirname, 'admin.html')
        }
      }
    },

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