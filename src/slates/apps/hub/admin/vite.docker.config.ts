import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  base: '/',
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router-dom', 'styled-components']
  },
  build: {
    outDir: path.resolve(__dirname, '../dist/admin'),
    emptyOutDir: true
  },
  server: {
    port: 52047,
    host: '0.0.0.0',
    proxy: {
      '/slates-hub-admin': 'http://slates-hub:52047'
    }
  }
});
