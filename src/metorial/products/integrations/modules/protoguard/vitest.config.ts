import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 60_000,
    server: {
      deps: {
        inline: [/@lowerdeck\//]
      }
    }
  }
});
