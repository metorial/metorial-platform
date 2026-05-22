import { resolve } from 'path';
import { defineConfig } from 'vitest/config';
import { createVitestConfig, loadTestEnv } from '@lowerdeck/testing-tools';

let clientsRoot = resolve(__dirname, '../../_clients');

export default defineConfig(({ mode }) => {
  let env = loadTestEnv(mode || 'test', process.cwd(), '');

  return createVitestConfig({
    test: {
      pool: 'forks',
      fileParallelism: false,
      include: ['src/**/*.e2e.test.ts'],
      setupFiles: ['./src/test/setup.ts'],
      env: {
        ...env,
        NODE_ENV: 'test'
      }
    },
    resolve: {
      alias: {
        '@metorial-platform-systems/voyager-client': resolve(
          clientsRoot,
          'voyager/src/index.ts'
        ),
        '@metorial-platform-systems/object-storage-client': resolve(
          clientsRoot,
          'object-storage/src/index.ts'
        )
      }
    }
  });
});
