import {
  bunService,
  ciImage,
  ciSuite,
  dev,
  e2e,
  endpoint,
  postgres,
  project,
  redis,
  stackMember
} from '@metorial/control';
import { baseDevEnv, ownMigration } from '@metorial/control/presets';

export default project({
  name: '@mtsrc/search-service',
  stacks: {
    cloud: stackMember(),
    'on-prem': stackMember({ mode: 'oss' })
  },
  group: 'oss',
  endpoints: {
    rpc: endpoint(52060).health('/ping').listenEnv('VOYAGER_PORT')
  },
  resources: [redis({ REDIS_URL: 'redis://{{HOSTNAME}}:{{PORT}}/0' })],
  dev: dev({
    run: ['dev:start'],
    env: baseDevEnv('oss'),
    databases: {
      main: postgres({
        package: '@mtsrc/search-service',
        name: 'voyager',
        env: 'DATABASE_URL'
      }),
      search: postgres({
        package: '@mtsrc/search-service',
        name: 'voyager-search',
        env: 'SEARCH_DATABASE_URL'
      })
    }
  }),
  e2e: e2e({ start: ['e2e:start'], image: 'search', tests: ['.'] }),
  ci: {
    images: [
      ciImage({
        name: 'search',
        group: 'oss',
        image: 'metorial/mte-search',
        ecr: 'metorial-enterprise-saas/mte-search',
        canonical: 'ghcr.io/metorial/search',
        build: bunService({
          ports: [52060],
          health: [
            { port: 52060, path: '/ping' },
            { port: 12121, path: '/' }
          ],
          migrations: [
            ownMigration('voyager', '@mtsrc/search-service', { path: 'prisma/schema.prisma' })
          ]
        })
      })
    ],
    suite: ciSuite({ name: 'search', runner: 'compose', profiles: ['infra', 'service'] })
  }
});
