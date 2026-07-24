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
    '@metorial-platform-systems/shuttle-client': resolve(configDir, '../clients/typescript/src/index.ts'),
    '@metorial/mcp-server': resolve(configDir, '../sdk/packages/mcp-server/src/index.ts'),
    '@metorial/mcp': resolve(configDir, '../sdk/packages/mcp/src/index.ts'),
    '@metorial/mcp-transport-memory': resolve(
      configDir,
      '../sdk/packages/mcp-transport-memory/src/index.ts'
    )
  });
});
