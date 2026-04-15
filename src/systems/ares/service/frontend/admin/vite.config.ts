import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],

  base: '/metorial-ares-admin',

  resolve: {
    dedupe: ['react', 'react-dom']
  },

  server: {
    port: 5174,
    proxy: {
      '/metorial-ares-admin/api': {
        target: 'http://localhost:52121',
        changeOrigin: true
      },
      '/favicon.ico': { target: 'http://localhost:52121', changeOrigin: true },
      '/favicon.svg': { target: 'http://localhost:52121', changeOrigin: true },
      '/favicon-96x96.png': { target: 'http://localhost:52121', changeOrigin: true },
      '/apple-touch-icon.png': { target: 'http://localhost:52121', changeOrigin: true }
    }
  },

  build: {
    outDir: 'dist'
  }
});
