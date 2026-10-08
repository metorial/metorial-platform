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
    '@metorial-platform-systems/shuttle-client': resolve(
      configDirectory,
      '../clients/shuttle/src/index.ts'
    ),
    '@metorial/mcp-server': resolve(
      configDirectory,
      '../sdk/packages/mcp-server/src/index.ts'
    ),
    '@metorial/mcp': resolve(configDirectory, '../sdk/packages/mcp/src/index.ts'),
    '@metorial/mcp-transport-memory': resolve(
      configDirectory,
      '../sdk/packages/mcp-transport-memory/src/index.ts'
    )
  });
});
