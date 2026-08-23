import { defineConfig } from 'vitest/config';

// Real-infra suite: runs only the docker-backed tests under tests/integration-real.
// globalSetup brings Redis + NATS up before the suite and tears them down after.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration-real/**/*.test.ts'],
    globalSetup: ['tests/integration-real/setup/globalSetup.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
    // Chaos tests restart the shared containers, so files must not run in
    // parallel against each other.
    pool: 'forks',
    fileParallelism: false
  }
});
