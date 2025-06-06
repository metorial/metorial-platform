import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: '0.0.0.0',
    allowedHosts: ['localhost', 'wsx', 'chronos', 'vulcan']
  },

  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-styled-components', {}],
        babelrc: false,
        configFile: false
      }
    })
  ],

  build: {
    rollupOptions: {
      output: {
        manualChunks: Object.fromEntries(
          [
            ['react'],
            ['react-dom'],
            ['react-router-dom'],
            ['react-use'],
            ['@metorial/ui', '@metorial/pages'],
            ['@metorial/data-hooks'],
            ['styled-components'],
            ['@sentry/browser', '@sentry/core', '@sentry/react'],
            ['apexcharts', 'react-apexcharts'],
            [
              '@codemirror/autocomplete',
              '@codemirror/lang-javascript',
              '@codemirror/lang-json',
              '@codemirror/language',
              '@lezer/highlight',
              '@lezer/lr',
              '@uiw/codemirror-themes',
              '@uiw/react-codemirror'
            ],
            ['@metorial/state']
            // [
            //   '@radix-ui/react-accordion',
            //   '@radix-ui/react-alert-dialog',
            //   '@radix-ui/react-checkbox',
            //   '@radix-ui/react-dialog',
            //   '@radix-ui/react-dropdown-menu',
            //   '@radix-ui/react-popover',
            //   '@radix-ui/react-select',
            //   '@radix-ui/react-switch',
            //   '@radix-ui/react-toggle-group',
            //   '@radix-ui/react-tooltip',
            //   '@radix-ui/react-visually-hidden'
            // ]
          ].map((p, i) => [`vendor-${i}`, p] as [string, string[]])
        )
      }
    },

    sourcemap: true
  }
});
