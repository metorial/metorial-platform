import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

let clientsRoot = resolve(__dirname, '../../_clients');

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.e2e.test.ts'],
    pool: 'forks'
  },
  resolve: {
    alias: {
      '@metorial-platform-systems/object-storage-client': resolve(
        clientsRoot,
        'object-storage/src/index.ts'
      )
    }
  }
});
