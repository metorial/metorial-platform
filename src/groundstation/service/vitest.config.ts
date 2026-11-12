import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.test.ts'],
    env: {
      NODE_ENV: 'test',
      GROUNDSTATION_HASH_SECRET: 'unit-test-hash-secret',
      DATABASE_URL: 'postgresql://unused:unused@localhost:1/groundstation-unit',
      REDIS_URL: 'redis://localhost:1'
    }
  }
});
