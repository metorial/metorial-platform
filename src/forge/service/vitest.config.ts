import { defineConfig } from 'vitest/config';
import { createVitestConfig, loadTestEnv } from '@lowerdeck/testing-tools';

export default defineConfig(({ mode }) => {
  const env = loadTestEnv(mode || 'test', process.cwd(), '');

  return createVitestConfig({
    test: {
      pool: 'forks',
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.e2e.test.ts'],
      setupFiles: ['./src/test/setup.ts'],
      env: {
        ...env,
        NODE_ENV: 'test'
      }
    }
  });
});
