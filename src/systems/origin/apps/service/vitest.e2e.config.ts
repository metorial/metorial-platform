import { defineConfig } from 'vitest/config';
import { createVitestConfig, loadTestEnv } from '@lowerdeck/testing-tools';

export default defineConfig(({ mode }) => {
  let env = loadTestEnv(mode || 'test', process.cwd(), '');

  return createVitestConfig({
    test: {
      pool: 'forks',
      fileParallelism: false,
      include: ['src/**/*.e2e.test.ts'],
      setupFiles: ['./src/test/preload-env.ts', './src/test/setup.ts'],
      env: {
        ...env,
        NODE_ENV: 'test'
      }
    }
  });
});
