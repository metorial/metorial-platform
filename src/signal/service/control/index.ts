import {
  bunService,
  ciImage,
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
import { baseDevEnv, ownMigration } from '@metorial/control/presets';

export default project({
  name: '@metorial/signal',
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
      main: postgres({ package: '@metorial/signal', name: 'signal', env: 'DATABASE_URL' })
    }
  }),
  e2e: e2e({
    start: ['e2e:start'],
    image: 'signal',
    env: {
      OBJECT_STORAGE_URL: 'http://services:52010'
    }
  }),
  ci: {
    images: [
      ciImage({
        name: 'signal',
        group: 'oss',
        image: 'metorial/mte-signal',
        ecr: 'metorial-enterprise-saas/mte-signal',
        canonical: 'ghcr.io/metorial/signal',
        build: bunService({
          ports: [52050],
          health: [
            { port: 52050, path: '/ping' },
            { port: 12121, path: '/' }
          ],
          migrations: [
            ownMigration('signal', '@metorial/signal', {
              prefix: 'SIGNAL',
              path: 'prisma/schema.prisma'
            })
          ]
        })
      })
    ]
  }
});
