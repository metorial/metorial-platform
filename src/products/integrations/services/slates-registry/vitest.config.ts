import { defineConfig } from 'vitest/config';
import { createVitestConfig, loadTestEnv } from '@lowerdeck/testing-tools';

export default defineConfig(({ mode }) => {
  let env = loadTestEnv(mode || 'test', process.cwd(), '');

  return createVitestConfig({
    test: {
      pool: 'forks',
      env: {
        ...env,
        NODE_ENV: 'test'
      }
    }
  });
});
