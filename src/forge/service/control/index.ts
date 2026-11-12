import {
  bunService,
  ciImage,
  ciSuite,
  dependency,
  dev,
  e2e,
  endpoint,
  mergeEnv,
  objectStorage,
  postgres,
  project,
  redis,
  stackMember
} from '@metorial/control';
import { baseDevEnv, pickEnv, ownMigration } from '@metorial/control/presets';

export default project({
  name: '@metorial/forge',
  stacks: {
    cloud: stackMember(),
    'on-prem': stackMember({ mode: 'oss' })
  },
  group: 'oss',
  endpoints: {
    api: endpoint(52020).health('/ping').listenEnv('FORGE_API_PORT')
  },
  dependencies: [
    dependency('@metorial/object-storage')
      .noStart()
      .env('api', 'OBJECT_STORAGE_URL', 'http://{{HOSTNAME}}:{{PORT}}')
  ],
  resources: [redis({ REDIS_URL: 'redis://{{HOSTNAME}}:{{PORT}}/0' })],
  dev: dev({
    run: ['dev:start'],
    env: mergeEnv(baseDevEnv('oss'), pickEnv('DEFAULT_PROVIDER', 'ENCRYPTION_KEY'), {
      ARTIFACT_BUCKET_NAME: 'artifacts',
      LOG_BUCKET_NAME: 'logs'
    }),
    databases: {
      main: postgres({ package: '@metorial/forge', name: 'forge', env: 'DATABASE_URL' })
    }
  }),
  e2e: e2e({
    start: ['e2e:start'],
    image: 'forge',
    tests: ['.'],
    env: {
      OBJECT_STORAGE_URL: 'http://services:52010'
    },
    resources: [objectStorage()]
  }),
  ci: {
    images: [
      ciImage({
        name: 'forge',
        group: 'oss',
        image: 'metorial/mte-forge',
        ecr: 'metorial-enterprise-saas/mte-forge',
        canonical: 'ghcr.io/metorial/forge',
        build: bunService({
          ports: [52020],
          health: [
            { port: 52020, path: '/ping' },
            { port: 12121, path: '/' }
          ],
          migrations: [
            ownMigration('forge', '@metorial/forge', {
              prefix: 'FORGE',
              path: 'prisma/schema.prisma'
            })
          ]
        })
      })
    ],
    suite: ciSuite({ name: 'forge', groups: 1 })
  }
});
