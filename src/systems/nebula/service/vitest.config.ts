import { defineConfig } from 'vitest/config';
import { createVitestConfig, loadTestEnv } from '@lowerdeck/testing-tools';

export default defineConfig(({ mode }) => {
  let env = loadTestEnv(mode || 'test', process.cwd(), '');

  return createVitestConfig({
    test: {
      pool: 'forks',
      setupFiles: ['./src/test/setup.ts'],
      env: {
        ...env,
        NODE_ENV: 'test',
        DATABASE_URL:
          env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/nebula-test',
        REDIS_URL: env.REDIS_URL ?? 'redis://localhost:6379/0',
        DEFAULT_PROVIDER: env.DEFAULT_PROVIDER ?? 'local',
        LOCAL_MASTER_SECRET:
          env.LOCAL_MASTER_SECRET ?? 'nebula-test-local-master-secret-with-enough-entropy',
        CONSUMER_INSTANCE_TOKEN_SECRET:
          env.CONSUMER_INSTANCE_TOKEN_SECRET ??
          'nebula-test-consumer-instance-token-secret-with-enough-entropy',
        CONSUMER_INSTANCE_TOKEN_TTL_SECONDS:
          env.CONSUMER_INSTANCE_TOKEN_TTL_SECONDS ?? '3600',
        KMS_EXTERNAL_KEY_ROLE_ARN:
          env.KMS_EXTERNAL_KEY_ROLE_ARN ??
          'arn:aws:iam::123456789012:role/metorial-test-nebula-task-role',
        CONSUMER_REGISTRATION_worker: env.CONSUMER_REGISTRATION_worker ?? 'worker-secret',
        CONSUMER_REGISTRATION_owner: env.CONSUMER_REGISTRATION_owner ?? 'owner-secret',
        CONSUMER_REGISTRATION_other: env.CONSUMER_REGISTRATION_other ?? 'other-secret'
      }
    }
  });
});
