import { resolve } from 'path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

let directory = resolve(fileURLToPath(new URL('.', import.meta.url)));

export default defineConfig({
  resolve: {
    alias: {
      '@lowerdeck/error': resolve(directory, 'src/test/lowerdeckError.ts')
    }
  },
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.e2e.test.ts'],
    pool: 'forks',
    server: { deps: { inline: ['@slates/proto'] } }
  }
});
