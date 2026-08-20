import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

let directory = resolve(fileURLToPath(new URL('.', import.meta.url)));

export default defineConfig({
  resolve: {
    alias: {
      '@lowerdeck/error': resolve(directory, 'src/test/lowerdeckError.ts')
    }
  },
  test: {
    server: { deps: { inline: true } },
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    env: {
      REDIS_URL: 'redis://127.0.0.1:6379',
      EMAIL_FROM: 'tests@metorial.invalid',
      EMAIL_FROM_NAME: 'Metorial Tests',
      API_URL: 'http://127.0.0.1:4310',
      FILES_URL: 'http://127.0.0.1:4311',
      APP_URL: 'http://127.0.0.1:3300',
      PORTALS_URL: 'http://127.0.0.1:3301',
      METORIAL_ENV: 'development',
      NODE_ENV: 'development',
      ENCRYPTION_SECRET: 'test-only-encryption-secret',
      NEBULA_API_URL: 'http://127.0.0.1:4312'
    }
  }
});
