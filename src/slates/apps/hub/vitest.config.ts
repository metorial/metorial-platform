import { dirname, resolve } from 'path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { createVitestConfig, loadTestEnv, withAliases } from '@lowerdeck/testing-tools';

let configDirectory = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadTestEnv(mode || 'test', process.cwd(), '');

  const config = createVitestConfig({
    test: {
      pool: 'forks',
      setupFiles: ['./src/test/setup.ts'],
      env: {
        ...env,
        NODE_ENV: 'test'
      }
    }
  });

  return withAliases(config, {
    '@slates/proto': resolve(configDirectory, '../../packages/proto/src/index.ts'),
    '@slates/provider': resolve(configDirectory, '../../packages/provider/src/index.ts'),
    '@metorial-services/slates-registry-client': resolve(
      configDirectory,
      '../../clients/registry/src/index.ts'
    ),
    '@metorial-services/slates-registry-internal-client': resolve(
      configDirectory,
      '../../clients/registry-internal/src/index.ts'
    )
  });
});
