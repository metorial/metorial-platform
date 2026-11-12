import { configDefaults, defineConfig } from 'vitest/config';

let realData = process.env.MODEL_CATALOG_REAL_DATA === '1';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: [...configDefaults.exclude, ...(realData ? [] : ['test/realData.test.ts'])],
    testTimeout: realData ? 600_000 : 30_000
  }
});
