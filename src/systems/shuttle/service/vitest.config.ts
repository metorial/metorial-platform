import { resolve } from 'path';
import { defineConfig } from 'vitest/config';
import { createVitestConfig, loadTestEnv, withAliases } from '@mtsrc/testing-tools';

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
    '@metorial-platform-systems/shuttle-client': resolve(__dirname, '../clients/typescript/src/index.ts'),
    '@metorial/mcp-server': resolve(__dirname, '../sdk/packages/mcp-server/src/index.ts'),
    '@metorial/mcp': resolve(__dirname, '../sdk/packages/mcp/src/index.ts'),
    '@metorial/mcp-transport-memory': resolve(
      __dirname,
      '../sdk/packages/mcp-transport-memory/src/index.ts'
    )
  });
});
