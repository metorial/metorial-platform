import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

let directory = resolve(fileURLToPath(new URL('.', import.meta.url)));

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [resolve(directory, 'test/setup.ts')],
    server: { deps: { inline: true } }
  }
});
