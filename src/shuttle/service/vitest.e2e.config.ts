import { defineConfig } from 'vitest/config';
import configuration from './vitest.config';

export default defineConfig(async context => {
  let base =
    typeof configuration === 'function' ? await configuration(context) : configuration;

  return {
    ...base,
    test: {
      ...base.test,
      include: ['src/**/*.e2e.test.ts'],
      exclude: ['**/node_modules/**', '**/dist/**'],
      fileParallelism: false,
      maxWorkers: 1
    }
  };
});
