import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react() as any],
  server: {
    host: '0.0.0.0',
    allowedHosts: ['localhost', 'wsx', 'chronos', 'vulcan']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    minify: false,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
});
