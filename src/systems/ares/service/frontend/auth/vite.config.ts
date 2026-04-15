import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],

  base: process.env.NODE_ENV === 'development' ? '/' : '/metorial-ares',

  resolve: {
    dedupe: ['react', 'react-dom']
  },

  server: {
    port: 5173,
    proxy: {
      '/metorial-ares/auth-api': {
        target: 'http://localhost:52120',
        changeOrigin: true
      },
      // Proxy static assets served by backend
      '/favicon.ico': { target: 'http://localhost:52120', changeOrigin: true },
      '/favicon.svg': { target: 'http://localhost:52120', changeOrigin: true },
      '/favicon-96x96.png': { target: 'http://localhost:52120', changeOrigin: true },
      '/apple-touch-icon.png': { target: 'http://localhost:52120', changeOrigin: true }
    }
  },

  build: {
    outDir: 'dist'
  }
});
