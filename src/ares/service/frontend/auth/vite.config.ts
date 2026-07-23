import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// `vite` (dev server) uses `/`; `vite build` must use the backend asset prefix.
export default defineConfig(({ command }) => ({
  plugins: [react()],

  base: command === 'serve' ? '/' : '/metorial-ares',

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
}));
