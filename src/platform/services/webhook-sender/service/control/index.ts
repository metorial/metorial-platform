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
import { baseDevEnv, ownMigration } from '@metorial/control/presets';

export default project({
  name: '@mtsrc/webhook-sender-service',
  stacks: {
    cloud: stackMember(),
    'on-prem': stackMember({ mode: 'oss' })
  },
  group: 'oss',
  endpoints: {
    api: endpoint(52050).health('/ping').listenEnv('SIGNAL_API_PORT')
  },
  dependencies: [
    dependency('@metorial/object-storage')
      .noStart()
      .env('api', 'OBJECT_STORAGE_URL', 'http://{{HOSTNAME}}:{{PORT}}')
  ],
  resources: [redis({ REDIS_URL: 'redis://{{HOSTNAME}}:{{PORT}}/0' })],
  dev: dev({
    env: mergeEnv(baseDevEnv('oss'), {
      LOGS_BUCKET_NAME: 'signal-logs'
    }),
    databases: {
      main: postgres({
        package: '@mtsrc/webhook-sender-service',
        name: 'signal',
        env: 'DATABASE_URL'
      })
    }
  }),
  e2e: e2e({
    start: ['e2e:start'],
    image: 'webhook-sender',
    tests: ['.'],
    env: {
      OBJECT_STORAGE_URL: 'http://services:52010'
    },
    resources: [objectStorage()]
  }),
  ci: {
    images: [
      ciImage({
        name: 'webhook-sender',
        group: 'oss',
        image: 'metorial/mte-webhook-sender',
        ecr: 'metorial-enterprise-saas/mte-webhook-sender',
        canonical: 'ghcr.io/metorial/webhook-sender',
        build: bunService({
          ports: [52050],
          health: [
            { port: 52050, path: '/ping' },
            { port: 12121, path: '/' }
          ],
          migrations: [
            ownMigration('signal', '@mtsrc/webhook-sender-service', {
              prefix: 'SIGNAL',
              path: 'prisma/schema.prisma'
            })
          ]
        })
      })
    ],
    suite: ciSuite({ name: 'webhook-sender', groups: 1 })
  }
});
