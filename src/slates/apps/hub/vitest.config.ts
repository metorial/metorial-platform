import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';
import { createVitestConfig, loadTestEnv, withAliases } from '@lowerdeck/testing-tools';

let configDir = fileURLToPath(new URL('.', import.meta.url));

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
    '@slates/proto': resolve(configDir, '../../packages/proto/src/index.ts'),
    '@slates/provider': resolve(configDir, '../../packages/provider/src/index.ts'),
    '@metorial-services/slates-registry-client': resolve(
      configDir,
      '../../clients/registry/src/index.ts'
    ),
    '@metorial-services/slates-registry-internal-client': resolve(
      configDir,
      '../../clients/registry-internal/src/index.ts'
    )
  });
});
