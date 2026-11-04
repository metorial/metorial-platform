import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    pool: 'forks',
    fileParallelism: false,
    include: ['src/**/*.integration.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://postgres:postgres@localhost:35432/groundstation-test',
      REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:36379/0'
    }
  }
});
