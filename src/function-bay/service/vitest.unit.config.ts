import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.e2e.test.ts', 'src/queues/enclaveOverride.test.ts'],
    env: {
      NODE_ENV: 'test',
      REDIS_URL: 'redis://127.0.0.1:6379',
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/function_bay_test',
      OBJECT_STORAGE_URL: 'http://127.0.0.1:9000',
      BUNDLE_BUCKET_NAME: 'function-bay-test',
      ENCRYPTION_KEY: 'unit-test-encryption-key',
      FORGE_API_URL: 'http://127.0.0.1:4310',
      DEFAULT_PROVIDER: 'local'
    }
  }
});
