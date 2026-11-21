import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      REDIS_URL: 'redis://localhost:1',
      NEBULA_API_URL: 'http://localhost:1',
      NEBULA_CONSUMER_TOKEN: 'unit-test-nebula-token'
    }
  }
});
