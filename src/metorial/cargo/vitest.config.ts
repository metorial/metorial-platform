import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

let resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@metorial/cargo-config/id': resolve('./packages/config/src/id.ts'),
      '@metorial/cargo-config': resolve('./packages/config/src/index.ts'),
      '@metorial/cargo-list-utils': resolve('./packages/list-utils/src/index.ts'),
      '@metorial/cargo-module-doc': resolve('./modules/doc/src/index.ts'),
      '@metorial/cargo-module-file': resolve('./modules/file/src/index.ts'),
      '@metorial/cargo-module-search': resolve('./modules/search/src/index.ts'),
      '@metorial/cargo-module-skill': resolve('./modules/skill/src/index.ts'),
      '@metorial/cargo-module-store': resolve('./modules/store/src/index.ts')
    }
  }
});
