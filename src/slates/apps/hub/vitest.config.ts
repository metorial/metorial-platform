import { resolve } from 'path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

let directory = resolve(fileURLToPath(new URL('.', import.meta.url)));

export default defineConfig(({ mode }) => {
  let env = loadEnv(mode || 'test', process.cwd(), '');
  let isCi =
    process.env.CI === 'true' ||
    process.env.GITHUB_ACTIONS === 'true' ||
    process.env.GITLAB_CI === 'true';
  return {
    resolve: {
      alias: {
        '@lowerdeck/error': resolve(directory, 'src/test/lowerdeckError.ts'),
        '@metorial-services/slates-registry-client': resolve(
          directory,
          '../../clients/registry/src/index.ts'
        ),
        '@metorial-services/slates-registry-internal-client': resolve(
          directory,
          '../../clients/registry-internal/src/index.ts'
        )
      }
    },
    test: {
      globals: true,
      environment: 'node',
      testTimeout: 30_000,
      hookTimeout: 30_000,
      sequence: { concurrent: false },
      fileParallelism: false,
      maxConcurrency: 1,
      allowOnly: !isCi,
      pool: 'forks',
      server: { deps: { inline: ['@slates/proto'] } },
      setupFiles: ['./src/test/setup.ts'],
      env: {
        ...env,
        NODE_ENV: 'test'
      }
    }
  };
});
