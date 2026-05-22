import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'src/**/*.test.ts',
      resolve(__dirname, '../../modules/skills/src/**/*.test.ts')
    ],
    exclude: ['src/**/*.e2e.test.ts'],
    pool: 'forks'
  }
});
