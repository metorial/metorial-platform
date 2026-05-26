import { defineConfig } from 'vitest/config';

let parseModules = () =>
  (process.env.CONTROL_E2E_MODULES ?? '')
    .split(',')
    .map(module => module.trim())
    .filter(Boolean);

let moduleGlobs = (moduleName: string) => {
  if (moduleName === 'all') {
    return [
      '../../modules/*/test/**/*.e2e.test.ts',
      '../../modules/*/src/**/*.e2e.test.ts',
      '../../../../../federation/backend/modules/*/test/**/*.e2e.test.ts',
      '../../../../../federation/backend/modules/*/src/**/*.e2e.test.ts'
    ];
  }

  if (moduleName.startsWith('federation/')) {
    let federationModule = moduleName.slice('federation/'.length);
    return [
      `../../../../../federation/backend/modules/${federationModule}/test/**/*.e2e.test.ts`,
      `../../../../../federation/backend/modules/${federationModule}/src/**/*.e2e.test.ts`
    ];
  }

  return [
    `../../modules/${moduleName}/test/**/*.e2e.test.ts`,
    `../../modules/${moduleName}/src/**/*.e2e.test.ts`
  ];
};

let selectedModuleGlobs = parseModules().flatMap(moduleGlobs);

export default defineConfig({
  test: {
    include: ['test/e2e/**/*.e2e.test.ts', ...selectedModuleGlobs],
    pool: 'threads',
    fileParallelism: false,
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      API_URL: process.env.API_URL ?? 'http://localhost:4310',
      APP_URL: process.env.APP_URL ?? 'http://localhost:3000',
      ADMIN_API_URL: process.env.ADMIN_API_URL ?? 'http://localhost:4322',
      ARES_AUTH_URL: process.env.ARES_AUTH_URL ?? 'http://localhost:5100',
      ARES_INTERNAL_URL: process.env.ARES_INTERNAL_URL ?? 'http://localhost:5100',
      BILLING_API_URL: process.env.BILLING_API_URL ?? 'http://localhost:4324',
      CARGO_API_URL: process.env.CARGO_API_URL ?? 'http://localhost:52040',
      COOKIE_DOMAIN: process.env.COOKIE_DOMAIN ?? 'localhost',
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/metorial',
      DASHBOARD_FRONTEND_HOST: process.env.DASHBOARD_FRONTEND_HOST ?? 'localhost:3000',
      EMAIL_ADDRESS: process.env.EMAIL_ADDRESS ?? 'test@metorial.com',
      EMAIL_FROM: process.env.EMAIL_FROM ?? 'test@metorial.com',
      EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME ?? 'Metorial Test',
      EMAIL_NAME: process.env.EMAIL_NAME ?? 'Metorial Test',
      ENCRYPTION_SECRET: process.env.ENCRYPTION_SECRET ?? 'control-test-encryption-secret',
      FEDERATION_CORE_DATABASE_URL:
        process.env.FEDERATION_CORE_DATABASE_URL ??
        'postgres://postgres:postgres@localhost:5432/metorial_federation',
      FEDERATION_API_HOST: process.env.FEDERATION_API_HOST ?? 'localhost:4320',
      FILES_URL: process.env.FILES_URL ?? 'http://localhost:4318',
      FILES_BUCKET_NAME: process.env.FILES_BUCKET_NAME ?? 'files',
      METORIAL_ENV: process.env.METORIAL_ENV ?? 'development',
      NODE_ENV: process.env.NODE_ENV ?? 'development',
      OBJECT_STORAGE_URL: process.env.OBJECT_STORAGE_URL ?? 'http://localhost:52010',
      PAYMENT_DATABASE_URL:
        process.env.PAYMENT_DATABASE_URL ??
        'postgres://postgres:postgres@localhost:5432/metorial_payment',
      PORTAL_HOST_TEMPLATE: process.env.PORTAL_HOST_TEMPLATE ?? 'http://{slug}.localhost:4315',
      PORTAL_REDIRECT_DOMAINS: process.env.PORTAL_REDIRECT_DOMAINS ?? 'localhost',
      PORTALS_URL: process.env.PORTALS_URL ?? 'http://localhost:4315',
      RELAY_URL: process.env.RELAY_URL ?? 'http://localhost:52110',
      REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379/0',
      SUBSPACE_CONNECTION_URL: process.env.SUBSPACE_CONNECTION_URL ?? 'http://localhost:52050',
      SUBSPACE_SOLUTION: process.env.SUBSPACE_SOLUTION ?? 'local',
      SUBSPACE_URL: process.env.SUBSPACE_URL ?? 'http://localhost:52050',
      SYNTHESIS_API_URL: process.env.SYNTHESIS_API_URL ?? 'http://localhost:52070',
      AUTH_TICKET_SECRET: process.env.AUTH_TICKET_SECRET ?? 'control-auth-ticket-secret'
    }
  }
});
