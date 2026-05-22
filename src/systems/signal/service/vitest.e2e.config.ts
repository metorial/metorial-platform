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
    '@metorial-platform-systems/signal-client': resolve(
      __dirname,
      '../../_clients/signal/src/index.ts'
    )
  });
});
