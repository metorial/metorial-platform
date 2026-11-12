import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    server: {
      deps: {
        inline: [/@lowerdeck\//, '@metorial/review-engine', '@metorial-services/scout-client']
      }
    }
  }
});
