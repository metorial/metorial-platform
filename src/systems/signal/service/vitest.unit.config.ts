import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.e2e.test.ts'],
    pool: 'forks'
  },
  resolve: {
    alias: {
      '@metorial-platform-systems/signal-client': resolve(
        __dirname,
        '../../_clients/signal/src/index.ts'
      )
    }
  }
});
