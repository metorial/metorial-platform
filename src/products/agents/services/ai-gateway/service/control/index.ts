import {
  bunService,
  ciImage,
  dependency,
  dev,
  e2e,
  endpoint,
  fromEnv,
  mergeEnv,
  mongodb,
  postgres,
  project,
  redis,
  stackMember
} from '@metorial/control';
import { baseDevEnv, ownMigration } from '@metorial/control/presets';

let platformEnvNames = [
  'AI_GATEWAY_PLATFORM_OPENAI_API_KEY',
  'AI_GATEWAY_PLATFORM_ANTHROPIC_API_KEY',
  'AI_GATEWAY_PLATFORM_GOOGLE_API_KEY',
  'AI_GATEWAY_PLATFORM_XAI_API_KEY',
  'AI_GATEWAY_PLATFORM_MISTRAL_API_KEY',
  'AI_GATEWAY_PLATFORM_DEEPSEEK_API_KEY',
  'AI_GATEWAY_PLATFORM_AZURE_API_KEY',
  'AI_GATEWAY_PLATFORM_AZURE_RESOURCE_NAME',
  'AI_GATEWAY_PLATFORM_CLOUDFLARE_API_TOKEN',
  'AI_GATEWAY_PLATFORM_CLOUDFLARE_ACCOUNT_ID',
  'AI_GATEWAY_PLATFORM_TYPESAFE_API_KEY'
];

export default project({
  name: '@mtsrc/ai-gateway-service',
  stacks: {
    cloud: stackMember(),
    'on-prem': stackMember({ mode: 'oss' })
  },
  group: 'oss',
  endpoints: {
    api: endpoint(52160).health('/ping').listenEnv('AI_GATEWAY_API_PORT'),
    inference: endpoint(52161).health('/ping').listenEnv('AI_GATEWAY_INFERENCE_PORT'),
    health: endpoint(12121).listenEnv('AI_GATEWAY_HEALTH_PORT')
  },
  dependencies: [
    dependency('@mtsrc/secret-store-service').env(
      'api',
      'NEBULA_API_URL',
      'http://{{HOSTNAME}}:{{PORT}}/metorial-nebula'
    )
  ],
  resources: [redis({ REDIS_URL: 'redis://{{HOSTNAME}}:{{PORT}}/0' })],
  dev: dev({
    env: mergeEnv(baseDevEnv('oss'), {
      NEBULA_CONSUMER_TOKEN: 'local-dev-nebula-ai-gateway-registration-secret',
      ...Object.fromEntries(
        platformEnvNames.map(name => [name, fromEnv(name, { required: false })])
      )
    }),
    databases: {
      main: postgres({
        package: '@mtsrc/ai-gateway-db',
        name: 'ai-gateway',
        env: 'AI_GATEWAY_DATABASE_URL'
      }),
      logs: mongodb({
        package: '@mtsrc/ai-gateway-db',
        name: 'ai-gateway-logs',
        env: 'AI_GATEWAY_MONGO_URL'
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
          ports: [52160, 52161],
          health: [
            { port: 52160, path: '/ping' },
            { port: 52161, path: '/ping' },
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
