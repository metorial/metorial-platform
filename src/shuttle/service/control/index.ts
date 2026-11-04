import {
  bunService,
  ciImage,
  ciSuite,
  dependency,
  dev,
  e2e,
  endpoint,
  mergeEnv,
  postgres,
  project,
  redis,
  stackMember
} from '@metorial/control';
import { baseDevEnv, pickEnv, ownMigration } from '@metorial/control/presets';

export default project({
  name: '@metorial/shuttle',
  stacks: {
    cloud: stackMember(),
    'on-prem': stackMember({ mode: 'oss' })
  },
  group: 'oss',
  endpoints: {
    api: endpoint(52080).health('/ping').listenEnv('SHUTTLE_API_PORT'),
    public: endpoint(52081)
      .listenEnv('SHUTTLE_PUBLIC_PORT')
      .env('PROVIDER_OAUTH_URL', 'http://localhost:{{BIND_PORT}}')
  },
  dependencies: [
    dependency('@metorial/object-storage')
      .noStart()
      .env('api', 'OBJECT_STORAGE_URL', 'http://{{HOSTNAME}}:{{PORT}}'),
    dependency('@metorial/function-bay').env(
      'api',
      'FUNCTION_BAY_API_URL',
      'http://{{HOSTNAME}}:{{PORT}}/metorial-function-bay'
    ),
    dependency('@metorial/nebula').env(
      'api',
      'NEBULA_API_URL',
      'http://{{HOSTNAME}}:{{PORT}}/metorial-nebula'
    )
  ],
  resources: [redis({ REDIS_URL: 'redis://{{HOSTNAME}}:{{PORT}}/0' })],
  dev: dev({
    run: ['dev:start'],
    env: mergeEnv(
      baseDevEnv('oss'),
      pickEnv('FUNCTION_BAY_DEFAULT_MEMORY_MB', 'FUNCTION_BAY_TENANT_IDENTIFIER'),
      {
        ENCRYPTION_KEY: 'local-dev-encryption-key',
        HOLOPOD_HTTP_ENDPOINT: 'http://holopod:3000',
        SHUTTLE_ALLOW_PRIVATE_URLS: 'true',
        SHUTTLE_UNSAFE_SSRF_BYPASS: 'true',
        LOGS_BUCKET_NAME: 'shuttle-logs',
        FUNCTION_BAY_DEFAULT_TIMEOUT_SECONDS: '15',
        NEBULA_CONSUMER_IDENTIFIER: 'dev-shuttle',
        NEBULA_CONSUMER_TOKEN: 'local-dev-nebula-shuttle-registration-secret',
        SHUTTLE_DELEGATE_SECRETS_TO_NEBULA: 'true'
      }
    ),
    databases: {
      main: postgres({ package: '@metorial/shuttle', name: 'shuttle', env: 'DATABASE_URL' })
    }
  }),
  e2e: e2e({
    start: ['e2e:start'],
    image: 'shuttle',
    env: {
      OBJECT_STORAGE_URL: 'http://services:52010'
    }
  }),
  ci: {
    images: [
      ciImage({
        name: 'shuttle',
        group: 'oss',
        image: 'metorial/mte-shuttle',
        ecr: 'metorial-enterprise-saas/mte-shuttle',
        canonical: 'ghcr.io/metorial/shuttle',
        build: bunService({
          ports: [52080, 52081],
          health: [
            { port: 52080, path: '/ping' },
            { port: 12121, path: '/' }
          ],
          migrations: [ownMigration('shuttle', '@metorial/shuttle', { prefix: 'SHUTTLE' })]
        })
      })
    ],
    suite: ciSuite({ name: 'shuttle', runner: 'compose', profiles: ['infra', 'service'] })
  }
});
