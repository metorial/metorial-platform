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
      GROUNDSTATION_HASH_SECRET: 'unit-test-hash-secret',
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://postgres:postgres@localhost:35432/groundstation-test',
      REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:36379/0',
      GROUNDSTATION_MONGO_URL:
        process.env.GROUNDSTATION_MONGO_URL ??
        'mongodb://mongo:mongo@localhost:32707/groundstation-test?authSource=admin'
    }
  }
});
