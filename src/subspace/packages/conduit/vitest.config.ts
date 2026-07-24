import { configDefaults, defineConfig } from 'vitest/config';

// Default suite: unit tests only. Integration suites use their explicit scripts.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    exclude: [...configDefaults.exclude, 'tests/integration-real/**'],
    testTimeout: 30000,
    hookTimeout: 30000
  }
});
