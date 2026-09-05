import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: [
      'src/**/*.e2e.test.ts',
      'src/test/cleanupCron.test.ts',
      'src/test/deploymentZeroDowntime.test.ts'
    ],
    pool: 'forks',
    env: {
      NODE_ENV: 'test',
      REDIS_URL: 'redis://127.0.0.1:6379',
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/slates_test',
      SERVICE_PUBLIC_URL: 'http://127.0.0.1:4310',
      METORIAL_ENV: 'development',
      FUNCTION_BAY_API_URL: 'http://127.0.0.1:4311',
      FUNCTION_BAY_TENANT_IDENTIFIER: 'unit-test',
      FUNCTION_BAY_DEFAULT_MEMORY_MB: '128',
      FUNCTION_BAY_DEFAULT_TIMEOUT_SECONDS: '30',
      SIGNAL_API_URL: 'http://127.0.0.1:4312',
      SIGNAL_SENDER_IDENTIFIER: 'unit-test',
      OBJECT_STORAGE_URL: 'http://127.0.0.1:9000',
      INVOCATIONS_BUCKET_NAME: 'unit-test',
      ENCRYPTION_KEY: 'unit-test-encryption-key',
      SLATES_HUB_INSTANCE_IDENTIFIER: 'unit-test',
      NEBULA_API_URL: 'http://127.0.0.1:4313',
      NEBULA_CONSUMER_IDENTIFIER: 'unit-test',
      NEBULA_CONSUMER_TOKEN: 'unit-test',
      SLATES_DELEGATE_SECRETS_TO_NEBULA: 'false'
    }
  }
});
