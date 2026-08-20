import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@lowerdeck/error': resolve(__dirname, 'src/impl/testLowerdeckError.ts')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    server: {
      deps: {
        inline: ['@lowerdeck/error', '@slates/proto']
      }
    }
  }
});
