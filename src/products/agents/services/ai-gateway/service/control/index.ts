import {
  bunService,
  ciImage,
  dev,
  e2e,
  endpoint,
  inherit,
  mergeEnv,
  postgres,
  project,
  redis,
  stackMember
} from '@metorial/control';
import { baseDevEnv, ownMigration } from '@metorial/control/presets';

export default project({
  name: '@mtsrc/ai-gateway-service',
  stacks: {
    cloud: stackMember(),
    'on-prem': stackMember({ mode: 'oss' })
  },
  group: 'oss',
  endpoints: {
    api: endpoint(52160).health('/ping').listenEnv('AI_GATEWAY_API_PORT'),
    health: endpoint(12121).listenEnv('AI_GATEWAY_HEALTH_PORT')
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
        package: '@mtsrc/ai-gateway-db',
        name: 'ai-gateway',
        env: 'AI_GATEWAY_DATABASE_URL'
      })
    }
  }),
  e2e: e2e({ start: ['e2e:start'], image: 'ai-gateway' }),
  ci: {
    images: [
      ciImage({
        name: 'ai-gateway',
        group: 'oss',
        image: 'metorial/mte-ai-gateway',
        ecr: 'metorial-enterprise-saas/mte-ai-gateway',
        canonical: 'ghcr.io/metorial/ai-gateway',
        build: bunService({
          include: ['@mtsrc/ai-gateway-db'],
          ports: [52160],
          health: [
            { port: 52160, path: '/ping' },
            { port: 12121, path: '/' }
          ],
          migrations: [
            ownMigration('ai-gateway', '@mtsrc/ai-gateway-db', { prefix: 'AI_GATEWAY' })
          ]
        })
      })
    ]
  }
});
