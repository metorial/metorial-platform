import { createVitestConfig, loadTestEnv } from '@lowerdeck/testing-tools';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }: any): any => {
  const env = loadTestEnv(mode || 'test', process.cwd(), '');

  return createVitestConfig({
    test: {
      pool: 'forks',
      setupFiles: ['./src/test/setup.ts'],
      env: {
        ...env,
        NODE_ENV: 'test'
      }
    }
  });
});
