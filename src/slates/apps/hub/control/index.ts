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
  objectStorage,
  postgres,
  project,
  redis,
  stackMember
} from '@metorial/control';
import { baseDevEnv, pickEnv, services, ownMigration } from '@metorial/control/presets';

export default project({
  name: '@metorial/slates',
  stacks: {
    cloud: stackMember(),
    'on-prem': stackMember({ mode: 'oss' })
  },
  group: 'oss',
  endpoints: {
    public: endpoint(52045)
      .health('/ping')
      .listenEnv('SLATES_HUB_PUBLIC_PORT')
      .env('SERVICE_PUBLIC_URL', 'http://{{HOSTNAME}}:{{PORT}}'),
    internal: endpoint(52046).listenEnv('SLATES_HUB_INTERNAL_PORT'),
    admin: endpoint(52047)
      .listenEnv('SLATES_HUB_ADMIN_PORT')
      .link({ label: 'Slates Hub Admin', group: 'admin' })
  },
  dependencies: [
    dependency('@metorial/object-storage')
      .noStart()
      .env('api', 'OBJECT_STORAGE_URL', 'http://{{HOSTNAME}}:{{PORT}}'),
    dependency('@mtsrc/functions-service').env(
      'api',
      'FUNCTION_BAY_API_URL',
      'http://{{HOSTNAME}}:{{PORT}}/metorial-function-bay'
    ),
    dependency('@metorial/signal').env(
      'api',
      'SIGNAL_API_URL',
      'http://{{HOSTNAME}}:{{PORT}}/metorial-signal'
    ),
    dependency('@mtsrc/secret-store-service').env(
      'api',
      'NEBULA_API_URL',
      'http://{{HOSTNAME}}:{{PORT}}/metorial-nebula'
    ),
    dependency('@metorial/slates-registry').env(
      'public',
      'INITIAL_REGISTRIES',
      'http://{{HOSTNAME}}:{{PORT}}'
    )
  ],
  resources: [redis({ REDIS_URL: 'redis://{{HOSTNAME}}:{{PORT}}/0' })],
  dev: dev({
    prepare: ['admin:build'],
    run: ['dev:start'],
    env: mergeEnv(
      baseDevEnv('oss'),
      pickEnv(
        'ENCRYPTION_KEY',
        'FUNCTION_BAY_DEFAULT_MEMORY_MB',
        'FUNCTION_BAY_TENANT_IDENTIFIER',
        'SLATE_ATTACHMENT_SIGNING_SECRET'
      ),
      {
        METORIAL_API_URL: services.coreApi.url(),
        FUNCTION_BAY_DEFAULT_TIMEOUT_SECONDS: '60',
        SIGNAL_SENDER_IDENTIFIER: 'dev-slates-hub',
        INVOCATIONS_BUCKET_NAME: 'dev-invocations',
        SLATES_HUB_INSTANCE_IDENTIFIER: 'dev-slates-hub',
        SUPPORTS_PREBUILT_SLATES: 'true',
        SLATES_SUB_REGISTRY_ID: 'local-hub',
        SLATE_DEPLOYMENT_NPM_REGISTRY_URL: inherit(),
        SLATES_WEBHOOK_TRIGGER_HOST: inherit(),
        NEBULA_CONSUMER_IDENTIFIER: 'dev-slates-hub',
        NEBULA_CONSUMER_TOKEN: 'local-dev-nebula-slates-registration-secret',
        SLATES_DELEGATE_SECRETS_TO_NEBULA: 'true',
        SUBSPACE_INTERNAL_URL: services.subspaceInternal.url('/subspace-internal')
      }
    ),
    databases: {
      main: postgres({ package: '@metorial/slates', name: 'slates-hub', env: 'DATABASE_URL' })
    }
  }),
  e2e: e2e({
    start: ['e2e:start'],
    image: 'slates-hub',
    tests: ['.'],
    env: {
      OBJECT_STORAGE_URL: 'http://services:52010'
    },
    resources: [objectStorage()]
  }),
  ci: {
    images: [
      ciImage({
        name: 'slates-hub',
        group: 'oss',
        image: 'metorial/mte-slates-hub',
        ecr: 'metorial-enterprise-saas/mte-slates-hub',
        canonical: 'ghcr.io/metorial/slates-hub',
        build: bunService({
          tasks: ['prisma:generate', 'server:build', 'admin:build'],
          ports: [52045, 52046, 52047],
          health: [
            { port: 52045, path: '/ping' },
            { port: 52046, path: '/ping' },
            { port: 12121, path: '/' }
          ],
          migrations: [
            ownMigration('slates-hub', '@metorial/slates', { prefix: 'SLATES_HUB' })
          ]
        })
      })
    ],
    suite: ciSuite({ name: 'slates-hub', groups: 1 })
  }
});
