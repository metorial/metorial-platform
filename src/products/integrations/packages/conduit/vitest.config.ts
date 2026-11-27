import { configDefaults, defineConfig } from 'vitest/config';

// Default suite: the fast, in-memory tests. Explicitly excludes the docker-backed
// real-infra suite so `bun run test` stays dockerless and unchanged.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: [...configDefaults.exclude, 'tests/integration-real/**'],
    testTimeout: 30000,
    hookTimeout: 30000
  }
});
