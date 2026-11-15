import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./test/setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000
  }
});
