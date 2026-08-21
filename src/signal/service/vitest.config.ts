import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

let directory = resolve(fileURLToPath(new URL('.', import.meta.url)));

let loadTestEnv = (mode: string) => {
  let values: Record<string, string> = {};
  for (let name of ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]) {
    let path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;
    for (let line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      let match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      let value = match[2] ?? '';
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      values[match[1]!] = value;
    }
  }
  return values;
};

let testDatabaseUrl = (values: Record<string, string>) => {
  let configured = process.env.SIGNAL_TEST_DATABASE_URL ?? values.SIGNAL_TEST_DATABASE_URL;
  if (configured) return configured;

  let base = process.env.DATABASE_URL ?? values.DATABASE_URL;
  if (!base) return undefined;
  let url = new URL(base);
  url.pathname = '/signal-test';
  return url.toString();
};

export default defineConfig(({ mode }) => {
  let env = loadTestEnv(mode || 'test');
  return {
    resolve: {
      alias: {
        '@metorial-platform-systems/signal-client': resolve(
          directory,
          '../clients/signal/src/index.ts'
        )
      }
    },
    test: {
      globals: true,
      environment: 'node',
      testTimeout: 30_000,
      hookTimeout: 30_000,
      sequence: { concurrent: false },
      fileParallelism: false,
      maxConcurrency: 1,
      allowOnly: !process.env.CI,
      pool: 'forks',
      setupFiles: ['./src/test/setup.ts'],
      env: {
        ...env,
        DATABASE_URL: testDatabaseUrl(env),
        NODE_ENV: 'test'
      },
      exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
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
          'src/test/**',
          'src/**/tests/**',
          'src/server.ts',
          'src/worker.ts',
          'src/db.ts',
          'src/storage.ts',
          'src/env.ts',
          'src/id.ts'
        ]
      }
    }
  };
});
