import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/lib/tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test'
    }
  }
});
