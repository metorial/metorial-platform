import { resolve } from 'path';
import { defineConfig } from 'vitest/config';
import { createVitestConfig, loadTestEnv, withAliases } from '@mtsrc/testing-tools';

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
    '@slates/proto': resolve(__dirname, '../../packages/proto/src/index.ts'),
    '@slates/provider': resolve(__dirname, '../../packages/provider/src/index.ts'),
    '@metorial-services/slates-registry-client': resolve(
      __dirname,
      '../../clients/registry/src/index.ts'
    ),
    '@metorial-services/slates-registry-internal-client': resolve(
      __dirname,
      '../../clients/registry-internal/src/index.ts'
    )
  });
});
