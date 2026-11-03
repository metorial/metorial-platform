import {
  ciImage,
  dev,
  e2e,
  endpoint,
  inherit,
  mergeEnv,
  postgres,
  project,
  redis
} from '@metorial/control';
import { baseDevEnv } from '@metorial/control/presets';

export default project({
  name: '@metorial/synthesis',
  group: 'oss',
  endpoints: {
    api: endpoint(52160).health('/ping').listenEnv('SYNTHESIS_API_PORT'),
    health: endpoint(12121).listenEnv('SYNTHESIS_HEALTH_PORT')
  },
  resources: [redis({ REDIS_URL: 'redis://{{HOSTNAME}}:{{PORT}}/0' })],
  dev: dev({
    env: mergeEnv(baseDevEnv('oss'), {
      AI_GATEWAY_API_KEY: inherit(),
      SCOUT_URL: 'https://scout-fra-fly-prod.metorial-enterprise.com/metorial-scout',
      SCOUT_TOKEN: inherit(),
      SUBSPACE_SOLUTION: 'metorial-dev'
    }),
    databases: {
      main: postgres({
        package: '@metorial/synthesis',
        name: 'synthesis',
        env: 'SYNTHESIS_DATABASE_URL'
      })
    }
  }),
  e2e: e2e({ start: ['e2e:start'], image: 'synthesis' }),
  ci: {
    images: [
      ciImage({
        name: 'synthesis',
        group: 'oss',
        dockerfile: 'Dockerfile',
        image: 'metorial/mte-synthesis',
        ecr: 'metorial-enterprise-saas/mte-synthesis',
        canonical: 'ghcr.io/metorial/synthesis'
      })
    ]
  }
});
