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
    '@function-bay/types': resolve(configDirectory, '../packages/types/src/index.ts')
  });
});
