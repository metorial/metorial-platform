import { createVitestConfig, loadTestEnv } from '@lowerdeck/testing-tools';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  let env = loadTestEnv(mode || 'test', process.cwd(), '');

  return createVitestConfig({
    test: {
      // Other Nebula suites import src/test/setup and require a live Postgres database.
      include: ['src/presenters/**/*.test.ts', 'src/adapters/**/*.test.ts'],
      exclude: ['src/**/*.e2e.test.ts'],
      pool: 'forks',
      env: {
        ...env,
        NODE_ENV: 'test',
        DEFAULT_PROVIDER: env.DEFAULT_PROVIDER ?? 'local',
        LOCAL_MASTER_SECRET:
          env.LOCAL_MASTER_SECRET ?? 'nebula-test-local-master-secret-with-enough-entropy',
        CONSUMER_INSTANCE_TOKEN_SECRET:
          env.CONSUMER_INSTANCE_TOKEN_SECRET ??
          'nebula-test-consumer-instance-token-secret-with-enough-entropy',
        CONSUMER_INSTANCE_TOKEN_TTL_SECONDS: env.CONSUMER_INSTANCE_TOKEN_TTL_SECONDS ?? '3600',
        KMS_EXTERNAL_KEY_ROLE_ARN:
          env.KMS_EXTERNAL_KEY_ROLE_ARN ??
          'arn:aws:iam::123456789012:role/metorial-test-nebula-task-role'
      }
    }
  });
});
