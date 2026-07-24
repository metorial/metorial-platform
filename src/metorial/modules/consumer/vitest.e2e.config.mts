import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@metorial\/db$/,
        replacement: new URL('./e2e/db.ts', import.meta.url).pathname
      }
    ]
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['e2e/**/*.e2e.ts'],
    pool: 'forks',
    fileParallelism: false,
    maxConcurrency: 1,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ['./e2e/setup.ts'],
    env: {
      NODE_ENV: 'test'
    }
  }
});
