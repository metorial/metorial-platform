import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { setupFiles: ['test/_setup.ts'] }
});
