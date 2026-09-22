import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const backendTarget = process.env.VITE_BACKEND_URL || 'http://localhost:5000';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  build: {
    outDir: path.resolve(__dirname, '../backend/public/admin'),
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
});
