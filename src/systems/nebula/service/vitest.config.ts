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
          env.LOCAL_MASTER_SECRET ?? 'nebula-test-local-master-secret-with-enough-entropy'
      }
    }
  });
});
