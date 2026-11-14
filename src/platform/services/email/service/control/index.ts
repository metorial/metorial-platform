import {
  bunService,
  ciImage,
  ciSuite,
  dev,
  e2e,
  endpoint,
  mail,
  postgres,
  project,
  redis,
  stackMember
} from '@metorial/control';
import { baseDevEnv, ownMigration } from '@metorial/control/presets';

export default project({
  name: '@mtsrc/email-service',
  stacks: {
    cloud: stackMember(),
    'on-prem': stackMember({ mode: 'oss' })
  },
  group: 'oss',
  endpoints: {
    rpc: endpoint(52110).health('/ping').listenEnv('RELAY_PORT')
  },
  resources: [
    redis({ REDIS_URL: 'redis://{{HOSTNAME}}:{{PORT}}/0' }),
    mail({ EMAIL_HOST: '{{HOSTNAME}}', EMAIL_PORT: '{{PORT}}', EMAIL_SECURE: 'false' })
  ],
  dev: dev({
    run: ['dev:start'],
    env: baseDevEnv('oss'),
    databases: {
      main: postgres({ package: '@mtsrc/email-service', name: 'relay', env: 'DATABASE_URL' })
    }
  }),
  e2e: e2e({ start: ['e2e:start'], image: 'email' }),
  ci: {
    images: [
      ciImage({
        name: 'email',
        group: 'oss',
        image: 'metorial/mte-email',
        ecr: 'metorial-enterprise-saas/mte-email',
        canonical: 'ghcr.io/metorial/email',
        build: bunService({
          ports: [52110],
          health: [
            { port: 52110, path: '/ping' },
            { port: 12121, path: '/' }
          ],
          migrations: [
            ownMigration('relay', '@mtsrc/email-service', { path: 'prisma/schema.prisma' })
          ]
        })
      })
    ],
    suite: ciSuite({ name: 'email', runner: 'compose', profiles: ['infra', 'service'] })
  }
});
