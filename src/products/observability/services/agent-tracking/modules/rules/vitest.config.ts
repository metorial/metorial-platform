import { defineConfig } from 'vitest/config';
import { unitTestEnv } from '@mtsrc/agent-tracking-testing/config';

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.test.ts'],
    env: unitTestEnv
  }
});
