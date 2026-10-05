import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';
import { createVitestConfig, loadTestEnv, withAliases } from '@lowerdeck/testing-tools';

let configDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadTestEnv(mode || 'test', process.cwd(), '');

  const config = createVitestConfig({
    test: {
      pool: 'forks',
      setupFiles: ['./src/test/setup.ts'],
      env: {
        ...env,
        NODE_ENV: 'test',
        REDIS_URL: env.REDIS_URL ?? 'redis://127.0.0.1:6379/0',
        DATABASE_URL: env.DATABASE_URL ?? 'postgresql://ares:ares@127.0.0.1:5432/ares-test',
        SSO_DATABASE_URL: env.SSO_DATABASE_URL ?? 'postgresql://ares:ares@127.0.0.1:5432/ares-sso-test',
        RELAY_URL: env.RELAY_URL ?? 'http://127.0.0.1:52110',
        ARES_AUTH_URL: env.ARES_AUTH_URL ?? 'http://127.0.0.1:52120',
        ARES_ADMIN_URL: env.ARES_ADMIN_URL ?? 'http://127.0.0.1:52121',
        ARES_SSO_URL: env.ARES_SSO_URL ?? 'http://127.0.0.1:52122',
        EMAIL_NAME: env.EMAIL_NAME ?? 'Ares Test',
        EMAIL_ADDRESS: env.EMAIL_ADDRESS ?? 'ares-test@example.com',
        SAML_AUDIENCE: env.SAML_AUDIENCE ?? 'https://saml.test.metorial.com',
        AUTH_TICKET_SECRET: env.AUTH_TICKET_SECRET ?? 'ares-test-auth-ticket-secret-with-enough-entropy'
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
  });

  return withAliases(config, {
    '@metorial-platform-systems/ares-client': resolve(
      configDir,
      '../clients/ares/src/index.ts'
    )
  });
});
