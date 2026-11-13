import {
  bunService,
  ciImage,
  dev,
  e2e,
  endpoint,
  mergeEnv,
  mongodb,
  postgres,
  project,
  redis,
  stackMember
} from '@metorial/control';
import { baseDevEnv, ownMigration } from '@metorial/control/presets';

export default project({
  name: '@metorial/groundstation',
  stacks: {
    cloud: stackMember(),
    'on-prem': stackMember({ mode: 'oss' })
  },
  group: 'oss',
  endpoints: {
    api: endpoint(52180).health('/ping').listenEnv('GROUNDSTATION_API_PORT'),
    ingest: endpoint(52181).health('/ping').listenEnv('GROUNDSTATION_INGEST_PORT')
  },
  resources: [redis({ REDIS_URL: 'redis://{{HOSTNAME}}:{{PORT}}/0' })],
  dev: dev({
    env: mergeEnv(baseDevEnv('oss'), {
      GROUNDSTATION_HASH_SECRET: 'dev-groundstation-hash-secret',
      GROUNDSTATION_CONTENT_SECRET: 'dev-groundstation-content-secret',
      GROUNDSTATION_SINK: 'mongo'
    }),
    databases: {
      main: postgres({
        package: '@metorial/groundstation',
        name: 'groundstation',
        env: 'DATABASE_URL'
      }),
      records: mongodb({
        package: '@metorial/groundstation',
        name: 'groundstation-records',
        env: 'GROUNDSTATION_MONGO_URL'
      })
    }
  }),
  e2e: e2e({
    start: ['e2e:start'],
    image: 'groundstation',
    tests: ['.'],
    env: {
      GROUNDSTATION_HASH_SECRET: 'e2e-groundstation-hash-secret',
      GROUNDSTATION_SINK: 'memory',
      GROUNDSTATION_MODEL_KNOWLEDGE_POLL_MINUTES: '0'
    }
  }),
  ci: {
    images: [
      ciImage({
        name: 'groundstation',
        group: 'oss',
        image: 'metorial/mte-groundstation',
        ecr: 'metorial-enterprise-saas/mte-groundstation',
        canonical: 'ghcr.io/metorial/groundstation',
        build: bunService({
          ports: [52181, 52180],
          health: [
            { port: 52181, path: '/ping' },
            { port: 12151, path: '/' }
          ],
          migrations: [
            ownMigration('groundstation', '@metorial/groundstation', {
              prefix: 'GROUNDSTATION',
              path: 'prisma/schema.prisma'
            })
          ]
        })
      })
    ]
  }
});
