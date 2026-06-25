import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**' // E2E tests run in Docker
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/prisma/**',
        'tests/**',
        'src/server.ts',
        'src/worker.ts',
        'src/db.ts',
        'src/storage.ts',
        'src/env.ts',
        'src/id.ts'
      ]
    },
    testTimeout: 30000,
    hookTimeout: 30000
  }
});
