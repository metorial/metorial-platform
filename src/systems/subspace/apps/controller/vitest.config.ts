import { createVitestConfig, loadTestEnv } from '@mtsrc/testing-tools';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }: any): any => {
  const env = loadTestEnv(mode || 'test', process.cwd(), '');

  return createVitestConfig({
    test: {
      pool: 'forks',
      ...(mode === 'ci'
        ? { fileParallelism: false, include: ['src/**/*.e2e.test.ts'] }
        : {}),
      setupFiles: ['./src/test/setup.ts'],
      env: {
        ...env,
        NODE_ENV: 'test'
      }
    }
  });
});
