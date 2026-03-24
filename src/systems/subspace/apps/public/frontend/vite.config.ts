import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],

  base: '/',

  resolve: {
    dedupe: ['react', 'react-dom']
  },

  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to the backend server
      '/subspace-public/internal-api': {
        target: 'http://localhost:52071',
        changeOrigin: true
      },
      // Proxy static assets served by backend
      '/favicon.ico': { target: 'http://localhost:52071', changeOrigin: true },
      '/favicon.svg': { target: 'http://localhost:52071', changeOrigin: true },
      '/favicon-96x96.png': { target: 'http://localhost:52071', changeOrigin: true },
      '/apple-touch-icon.png': { target: 'http://localhost:52071', changeOrigin: true },
      '/site.webmanifest': { target: 'http://localhost:52071', changeOrigin: true }
    }
  },

  build: {
    outDir: 'dist'
  }
});

// import { defineConfig } from 'vite';

// // https://vitejs.dev/config/
// export default defineConfig({
//   // server: {
//   //   host: '0.0.0.0'
//   // },
//   // plugins: [
//   //   react({
//   //     babel: {
//   //       plugins: ['styled-components'],
//   //       babelrc: false,
//   //       configFile: false
//   //     }
//   //   }) as any
//   // ],
//   // build: {
//   //   rollupOptions: {
//   //     output: {
//   //       // manualChunks: Object.fromEntries(
//   //       //   [
//   //       //     ['react'],
//   //       //     ['react-dom'],
//   //       //     ['react-router-dom'],
//   //       //     ['react-use'],
//   //       //     ['@metorial/ui', '@metorial/pages'],
//   //       //     ['@metorial/data-hooks'],
//   //       //     ['styled-components'],
//   //       //     // ['@sentry/browser'],
//   //       //     ...[
//   //       //       '@radix-ui/react-accordion',
//   //       //       '@radix-ui/react-alert-dialog',
//   //       //       '@radix-ui/react-checkbox',
//   //       //       '@radix-ui/react-dialog',
//   //       //       '@radix-ui/react-dropdown-menu',
//   //       //       '@radix-ui/react-popover',
//   //       //       '@radix-ui/react-select',
//   //       //       '@radix-ui/react-switch',
//   //       //       '@radix-ui/react-toggle-group',
//   //       //       '@radix-ui/react-tooltip',
//   //       //       '@radix-ui/react-visually-hidden'
//   //       //     ].map(p => [p])
//   //       //   ].map((p, i) => [`vendor-${i}`, p] as [string, string[]])
//   //       // )
//   //     }
//   //   },
//   //   sourcemap: true
//   // }
// });
