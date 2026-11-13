import { defineConfig } from 'vitest/config';
import { integrationTestEnv } from '@mtsrc/agent-tracking-testing/config';

export default defineConfig({
  test: {
    environment: 'node',
    pool: 'forks',
    fileParallelism: false,
    include: ['test/**/*.integration.test.ts'],
    setupFiles: ['./test/setup.ts'],
    env: integrationTestEnv
  }
});
