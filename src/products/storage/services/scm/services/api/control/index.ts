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
import { baseDevEnv, pickEnv, ownMigration } from '@metorial/control/presets';

export default project({
  name: '@mtsrc/scm-service',
  stacks: {
    cloud: stackMember(),
    'on-prem': stackMember({ mode: 'oss' })
  },
  group: 'oss',
  mode: 'enterprise',
  endpoints: {
    api: endpoint(52090).health('/ping').listenEnv('ORIGIN_API_PORT'),
    scm: endpoint(52093)
      .listenEnv('ORIGIN_SCM_PORT')
      .env('ORIGIN_SERVICE_PUBLIC_URL', 'http://{{HOSTNAME}}:{{PORT}}')
  },
  dependencies: [
    dependency('@metorial/object-storage')
      .noStart()
      .env('api', 'OBJECT_STORAGE_URL', 'http://{{HOSTNAME}}:{{PORT}}'),
    dependency('@mtsrc/secret-store-service').env(
      'api',
      'NEBULA_API_URL',
      'http://{{HOSTNAME}}:{{PORT}}/metorial-nebula'
    ),
    dependency('@mtsrc/scm-code-bucket-service')
      .env('rpc', 'CODE_BUCKET_SERVICE_URL', '{{HOSTNAME}}:{{PORT}}')
      .env('workspace', 'CODE_BUCKET_EDITOR_URL', 'http://{{HOSTNAME}}:{{PORT}}')
  ],
  resources: [redis({ REDIS_URL: 'redis://{{HOSTNAME}}:{{PORT}}/0' })],
  dev: dev({
    run: ['dev:start'],
    env: mergeEnv(baseDevEnv('oss'), pickEnv('CODE_BUCKET_OBJECT_STORAGE_BUCKET'), {
      NEBULA_CONSUMER_TOKEN: 'local-dev-nebula-origin-registration-secret',
      ORIGIN_DELEGATE_SECRETS_TO_NEBULA: 'true',
      ORIGIN_MANIFEST_SOURCE_BUCKETS: 'mte-files',
      SCM_GITHUB_APP_ID: inherit(),
      SCM_GITHUB_APP_SLUG: inherit(),
      SCM_GITHUB_APP_PRIVATE_KEY_BASE_64: inherit(),
      SCM_GITHUB_APP_CLIENT_ID: inherit(),
      SCM_GITHUB_APP_CLIENT_SECRET: inherit(),
      SCM_GITLAB_CLIENT_ID: inherit(),
      SCM_GITLAB_CLIENT_SECRET: inherit(),
      SCM_BITBUCKET_CLIENT_ID: inherit(),
      SCM_BITBUCKET_CLIENT_SECRET: inherit()
    }),
    databases: {
      main: postgres({ package: '@mtsrc/scm-service', name: 'origin', env: 'DATABASE_URL' })
    }
  }),
  e2e: e2e({
    start: ['e2e:start'],
    image: 'scm',
    tests: ['.'],
    env: {
      OBJECT_STORAGE_URL: 'http://services:52010',
      CODE_BUCKET_OBJECT_STORAGE_BUCKET: 'code-bucket',
      NEBULA_CONSUMER_TOKEN: 'e2e-origin-registration-secret'
    },
    resources: [objectStorage()]
  }),
  ci: {
    images: [
      ciImage({
        name: 'scm',
        group: 'oss',
        image: 'metorial/mte-scm',
        ecr: 'metorial-enterprise-saas/mte-scm',
        canonical: 'ghcr.io/metorial/mte-scm',
        build: bunService({
          ports: [52090, 52093],
          health: [
            { port: 52090, path: '/ping' },
            { port: 12121, path: '/' }
          ],
          migrations: [ownMigration('origin', '@mtsrc/scm-service', { prefix: 'ORIGIN' })]
        })
      })
    ],
    suite: ciSuite({ name: 'scm', groups: 1 })
  }
});
