import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      REDIS_URL: 'redis://127.0.0.1:6379',
      SIGNAL_API_URL: 'http://127.0.0.1:4313',
      NODE_ENV: 'test'
    }
  }
});
