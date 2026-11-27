import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],

  base: '/',

  resolve: {
    dedupe: ['react', 'react-dom']
  },

  server: {
    port: 52071
  }
});
