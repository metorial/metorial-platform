import {
  bunService,
  ciImage,
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
    env: mergeEnv(baseDevEnv('oss')),
    databases: {
      main: postgres({
        package: '@metorial/groundstation',
        name: 'groundstation',
        env: 'DATABASE_URL'
      })
    }
  }),
  e2e: e2e({
    start: ['e2e:start'],
    image: 'groundstation',
    tests: ['.']
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
