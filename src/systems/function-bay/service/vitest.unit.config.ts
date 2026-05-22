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
      '@function-bay/types': resolve(__dirname, '../packages/types/src/index.ts')
    }
  }
});
