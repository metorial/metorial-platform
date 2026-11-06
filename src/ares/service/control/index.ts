import {
  bunService,
  ciImage,
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
  name: '@metorial/ares',
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
    dependency('@metorial/relay').env(
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
      main: postgres({ package: '@metorial/ares', name: 'ares', env: 'DATABASE_URL' }),
      sso: postgres({ package: '@metorial/ares', name: 'ares-sso', env: 'SSO_DATABASE_URL' })
    }
  }),
  e2e: e2e({ start: ['e2e:start'], image: 'ares', tests: ['.'] }),
  ci: {
    images: [
      ciImage({
        name: 'ares',
        group: 'oss',
        image: 'metorial/mte-ares',
        ecr: 'metorial-enterprise-saas/mte-ares',
        canonical: 'ghcr.io/metorial/ares',
        build: bunService({
          tasks: ['prisma:generate', 'server:build', 'frontend:build'],
          ports: [52120, 52121, 52122, 52123, 12121],
          health: [
            { port: 52120, path: '/ping' },
            { port: 12121, path: '/' }
          ],
          assets: [{ from: 'frontend/auth/dist' }, { from: 'frontend/admin/dist' }],
          migrations: [ownMigration('ares', '@metorial/ares')]
        })
      })
    ]
  }
});
