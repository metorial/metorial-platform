import { unitTestEnv } from '@mtsrc/agent-tracking-testing/config';
import { defineConfig } from 'vitest/config';
import { metorialConfigPlaceholders } from './src/lib/placeholders';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    env: { ...unitTestEnv, ...metorialConfigPlaceholders }
  }
});
