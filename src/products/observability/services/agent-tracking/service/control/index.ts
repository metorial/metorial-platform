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
  name: '@mtsrc/agent-tracking-service',
  stacks: {
    cloud: stackMember(),
    'on-prem': stackMember({ mode: 'oss' })
  },
  group: 'oss',
  endpoints: {
    api: endpoint(52180).health('/ping').listenEnv('AGENT_TRACKING_API_PORT'),
    ingest: endpoint(52181).health('/ping').listenEnv('AGENT_TRACKING_INGEST_PORT')
  },
  resources: [redis({ REDIS_URL: 'redis://{{HOSTNAME}}:{{PORT}}/0' })],
  dev: dev({
    env: mergeEnv(baseDevEnv('oss'), {
      AGENT_TRACKING_HASH_SECRET: 'dev-agent-tracking-hash-secret',
      AGENT_TRACKING_CONTENT_SECRET: 'dev-agent-tracking-content-secret',
      AGENT_TRACKING_SINK: 'mongo'
    }),
    databases: {
      main: postgres({
        package: '@mtsrc/agent-tracking-db',
        name: 'agent-tracking',
        env: 'DATABASE_URL'
      }),
      records: mongodb({
        package: '@mtsrc/agent-tracking-db',
        name: 'agent-tracking-records',
        env: 'AGENT_TRACKING_MONGO_URL'
      })
    }
  }),
  e2e: e2e({
    start: ['e2e:start'],
    image: 'agent-tracking',
    tests: ['.'],
    env: {
      AGENT_TRACKING_HASH_SECRET: 'e2e-agent-tracking-hash-secret',
      AGENT_TRACKING_SINK: 'memory',
      AGENT_TRACKING_MODEL_KNOWLEDGE_POLL_MINUTES: '0'
    }
  }),
  ci: {
    images: [
      ciImage({
        name: 'agent-tracking',
        group: 'oss',
        image: 'metorial/mte-agent-tracking',
        ecr: 'metorial-enterprise-saas/mte-agent-tracking',
        canonical: 'ghcr.io/metorial/agent-tracking',
        build: bunService({
          ports: [52181, 52180],
          health: [
            { port: 52181, path: '/ping' },
            { port: 12151, path: '/' }
          ],
          migrations: [
            ownMigration('agent-tracking', '@mtsrc/agent-tracking-db', {
              prefix: 'AGENT_TRACKING'
            })
          ]
        })
      })
    ]
  }
});
