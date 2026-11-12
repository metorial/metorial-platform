import {
  bunService,
  ciImage,
  ciSuite,
  dev,
  e2e,
  endpoint,
  mergeEnv,
  postgres,
  project,
  redis,
  stackMember
} from '@metorial/control';
import { baseDevEnv, pickEnv, ownMigration } from '@metorial/control/presets';

export default project({
  name: '@metorial/nebula',
  stacks: {
    cloud: stackMember(),
    'on-prem': stackMember({ mode: 'oss' })
  },
  group: 'oss',
  endpoints: {
    api: endpoint(52170).health('/ping').listenEnv('NEBULA_API_PORT')
  },
  resources: [redis({ REDIS_URL: 'redis://{{HOSTNAME}}:{{PORT}}/0' })],
  dev: dev({
    run: ['dev:start'],
    env: mergeEnv(baseDevEnv('oss'), pickEnv('DEFAULT_PROVIDER'), {
      LOCAL_MASTER_SECRET: 'local-dev-nebula-master-secret-with-enough-entropy',
      KMS_AWS_REGION: 'us-east-1',
      KMS_CREATE_DEFAULT_KEY: 'false',
      CONSUMER_INSTANCE_TOKEN_SECRET:
        'local-dev-nebula-consumer-token-secret-with-enough-entropy',
      CONSUMER_INSTANCE_TOKEN_TTL_SECONDS: '3600',
      CONSUMER_REGISTRATION_SLATES: 'local-dev-nebula-slates-registration-secret',
      CONSUMER_REGISTRATION_SHUTTLE: 'local-dev-nebula-shuttle-registration-secret',
      CONSUMER_REGISTRATION_ORIGIN: 'local-dev-nebula-origin-registration-secret'
    }),
    databases: {
      main: postgres({ package: '@metorial/nebula', name: 'nebula', env: 'DATABASE_URL' })
    }
  }),
  e2e: e2e({
    start: ['e2e:start'],
    image: 'nebula',
    tests: ['.'],
    env: {
      CONSUMER_REGISTRATION_WORKER: 'e2e-worker-registration-secret',
      CONSUMER_REGISTRATION_OWNER: 'e2e-owner-registration-secret',
      CONSUMER_REGISTRATION_OTHER: 'e2e-other-registration-secret',
      CONSUMER_REGISTRATION_ORIGIN: 'e2e-origin-registration-secret'
    }
  }),
  ci: {
    images: [
      ciImage({
        name: 'nebula',
        group: 'oss',
        image: 'metorial/mte-nebula',
        ecr: 'metorial-enterprise-saas/mte-nebula',
        canonical: 'ghcr.io/metorial/nebula',
        build: bunService({
          ports: [52170],
          health: [
            { port: 52170, path: '/ping' },
            { port: 12121, path: '/' }
          ],
          migrations: [ownMigration('nebula', '@metorial/nebula', { prefix: 'NEBULA' })]
        })
      })
    ],
    suite: ciSuite({ name: 'nebula', groups: 1 })
  }
});
