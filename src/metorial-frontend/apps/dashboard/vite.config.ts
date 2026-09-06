import react from '@vitejs/plugin-react';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

let workspaceRoot = fileURLToPath(new URL('../../../../../', import.meta.url));

let stripBrokenMonacoSourceMap = () => ({
  name: 'strip-broken-monaco-source-map',
  apply: 'serve' as const,
  enforce: 'pre' as const,
  async load(id: string) {
    if (!id.includes('/monaco-editor/esm/vs/base/common/marked/marked.js')) return;

    let code = await readFile(id.split('?')[0], 'utf8');
    return code.replace(/\n\/\/# sourceMappingURL=marked\.umd\.js\.map\s*$/, '');
  }
});

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 3300,
    allowedHosts: ['localhost', 'wsx', 'chronos', 'vulcan'],
    fs: { allow: [workspaceRoot] }
  },

  plugins: [
    stripBrokenMonacoSourceMap(),
    react({
      exclude: /clients\/metorial-dashboard\/dist/,
      babel: {
        plugins: ['babel-plugin-styled-components', {}],
        babelrc: false,
        configFile: false
      }
    })
  ],

  optimizeDeps: {
    exclude: ['monaco-editor']
  },

  build: {
    rollupOptions: {
      output: {}
    },

    sourcemap: true
  }
});
