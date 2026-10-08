import { defineConfig } from 'vitest/config';
import configuration from './vitest.config';

export default defineConfig(async context => {
  let base =
    typeof configuration === 'function' ? await configuration(context) : configuration;

  return {
    ...base,
    test: {
      ...base.test,
      include: ['src/**/*.test.ts'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        'src/presenters/**/*.test.ts',
        'src/adapters/**/*.test.ts',
        'src/services/consumer.test.ts'
      ],
      fileParallelism: false,
      maxWorkers: 1
    }
  };
});
