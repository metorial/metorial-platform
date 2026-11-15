import {
  bunService,
  ciImage,
  ciSuite,
  dependency,
  dev,
  e2e,
  endpoint,
  inherit,
  mergeEnv,
  postgres,
  project,
  redis,
  stackMember
} from '@metorial/control';
import { baseDevEnv, ownMigration } from '@metorial/control/presets';

export default project({
  name: '@mtsrc/auth-core-service',
  stacks: {
    cloud: stackMember(),
    'on-prem': stackMember({ mode: 'oss' })
  },
  group: 'oss',
  endpoints: {
    auth: endpoint(52120)
      .health('/ping')
      .listenEnv('ARES_AUTH_PORT')
      .env('ARES_AUTH_URL', 'http://{{HOSTNAME}}:{{PORT}}'),
    admin: endpoint(52121)
      .listenEnv('ARES_ADMIN_PORT')
      .env('ARES_ADMIN_URL', 'http://{{HOSTNAME}}:{{PORT}}'),
    sso: endpoint(52122)
      .listenEnv('ARES_SSO_PORT')
      .env('ARES_SSO_URL', 'http://{{HOSTNAME}}:{{PORT}}'),
    internal: endpoint(52123).listenEnv('ARES_INTERNAL_PORT')
  },
  dependencies: [
    dependency('@mtsrc/email-service').env(
      'rpc',
      'RELAY_URL',
      'http://{{HOSTNAME}}:{{PORT}}/metorial-relay'
    )
  ],
  resources: [redis({ REDIS_URL: 'redis://{{HOSTNAME}}:{{PORT}}/0' })],
  dev: dev({
    prepare: ['frontend:build'],
    run: ['dev:start'],
    env: mergeEnv(baseDevEnv('oss'), {
      EMAIL_NAME: 'Ares Dev',
      EMAIL_ADDRESS: 'dev@metorial.com',
      SAML_AUDIENCE: 'https://saml.dev.metorial.com',
      AUTH_TICKET_SECRET: 'dev-secret-change-in-production',
      TWO_FACTOR_SETUP_ENABLED: 'true',
      TWO_FACTOR_ENCRYPTION_KEY: 'dev-two-factor-key-change-in-production',
      TURNSTILE_SITE_KEY: inherit(),
      TURNSTILE_SECRET_KEY: inherit()
    }),
    databases: {
      main: postgres({
        package: '@mtsrc/auth-core-db',
        name: 'ares',
        env: 'DATABASE_URL'
      }),
      sso: postgres({
        package: '@mtsrc/auth-core-db',
        name: 'ares-sso',
        env: 'SSO_DATABASE_URL'
      })
    }
  }),
  e2e: e2e({ start: ['e2e:start'], image: 'auth-core', tests: ['.'] }),
  ci: {
    images: [
      ciImage({
        name: 'auth-core',
        group: 'oss',
        image: 'metorial/mte-auth-core',
        ecr: 'metorial-enterprise-saas/mte-auth-core',
        canonical: 'ghcr.io/metorial/auth-core',
        build: bunService({
          include: [
            '@mtsrc/auth-core-db',
            '@mtsrc/auth-core-frontend-auth',
            '@mtsrc/auth-core-frontend-admin'
          ],
          tasks: ['prisma:generate', 'server:build', 'frontend:build'],
          sources: ['src/products/identity/services/auth-core/frontends/public'],
          ports: [52120, 52121, 52122, 52123, 12121],
          health: [
            { port: 52120, path: '/ping' },
            { port: 12121, path: '/' }
          ],
          assets: [
            {
              from: '/src/products/identity/services/auth-core/frontends/auth/dist',
              to: 'frontend/auth/dist'
            },
            {
              from: '/src/products/identity/services/auth-core/frontends/admin/dist',
              to: 'frontend/admin/dist'
            },
            {
              from: '/src/products/identity/services/auth-core/frontends/public',
              to: 'frontend/public'
            }
          ],
          migrations: [ownMigration('ares', '@mtsrc/auth-core-db')]
        })
      })
    ],
    suite: ciSuite({ name: 'auth-core', groups: 1 })
  }
});
