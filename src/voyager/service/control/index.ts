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
  name: '@metorial/voyager',
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
      main: postgres({ package: '@metorial/voyager', name: 'voyager', env: 'DATABASE_URL' }),
      search: postgres({
        package: '@metorial/voyager',
        name: 'voyager-search',
        env: 'SEARCH_DATABASE_URL'
      })
    }
  }),
  e2e: e2e({ start: ['e2e:start'], image: 'voyager', tests: ['.'] }),
  ci: {
    images: [
      ciImage({
        name: 'voyager',
        group: 'oss',
        image: 'metorial/mte-voyager',
        ecr: 'metorial-enterprise-saas/mte-voyager',
        canonical: 'ghcr.io/metorial/voyager',
        build: bunService({
          ports: [52060],
          health: [
            { port: 52060, path: '/ping' },
            { port: 12121, path: '/' }
          ],
          migrations: [
            ownMigration('voyager', '@metorial/voyager', { path: 'prisma/schema.prisma' })
          ]
        })
      })
    ],
    suite: ciSuite({ name: 'voyager', runner: 'compose', profiles: ['infra', 'service'] })
  }
});
