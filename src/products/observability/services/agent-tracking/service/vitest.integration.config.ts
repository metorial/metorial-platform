import { integrationTestEnv } from '@mtsrc/agent-tracking-testing/config';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    pool: 'forks',
    fileParallelism: false,
    include: ['test/**/*.integration.test.ts'],
    setupFiles: ['./test/listeners.ts', './test/setup.ts'],
    env: integrationTestEnv
  }
});
