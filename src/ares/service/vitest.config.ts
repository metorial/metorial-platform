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
      },
      exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/**',
          'dist/**',
          '**/*.d.ts',
          '**/*.config.ts',
          '**/prisma/**',
          'tests/**',
          'src/test/**',
          'src/**/tests/**',
          'src/server.ts',
          'src/worker.ts',
          'src/db.ts',
          'src/storage.ts',
          'src/env.ts',
          'src/id.ts'
        ]
      }
    }
  });

  return withAliases(config, {
    '@metorial-platform-systems/ares-client': resolve(
      configDir,
      '../clients/ares/src/index.ts'
    )
  });
});
