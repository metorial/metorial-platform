import { resolve } from 'path';
import { defineConfig } from 'vitest/config';
import { createVitestConfig, loadTestEnv, withAliases } from '@lowerdeck/testing-tools';

export default defineConfig(({ mode }) => {
  let env = loadTestEnv(mode || 'test', process.cwd(), '');

  let config = createVitestConfig({
    test: {
      pool: 'forks',
      include: ['src/**/*.e2e.test.ts'],
      setupFiles: ['./src/test/setup.ts'],
      env: {
        ...env,
        NODE_ENV: 'test'
      }
    }
  });

  return withAliases(config, {
    '@function-bay/types': resolve(__dirname, '../packages/types/src/index.ts'),
    '@metorial-platform-systems/object-storage-client': resolve(
      __dirname,
      '../../_clients/object-storage/src/index.ts'
    )
  });
});
