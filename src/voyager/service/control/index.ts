import {
  ciImage,
  ciSuite,
  dev,
  e2e,
  endpoint,
  postgres,
  project,
  redis
} from '@metorial/control';
import { baseDevEnv } from '@metorial/control/presets';

export default project({
  name: '@metorial/voyager',
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
  e2e: e2e({ start: ['e2e:start'], image: 'voyager' }),
  ci: {
    images: [
      ciImage({
        name: 'voyager',
        group: 'oss',
        dockerfile: 'Dockerfile',
        image: 'metorial/mte-voyager',
        ecr: 'metorial-enterprise-saas/mte-voyager',
        canonical: 'ghcr.io/metorial/voyager'
      })
    ],
    suite: ciSuite({ name: 'voyager', runner: 'compose', profiles: ['infra', 'service'] })
  }
});
