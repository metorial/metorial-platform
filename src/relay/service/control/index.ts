import {
  ciImage,
  ciSuite,
  dev,
  e2e,
  endpoint,
  mail,
  postgres,
  project,
  redis
} from '@metorial/control';
import { baseDevEnv } from '@metorial/control/presets';

export default project({
  name: '@metorial/relay',
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
      main: postgres({ package: '@metorial/relay', name: 'relay', env: 'DATABASE_URL' })
    }
  }),
  e2e: e2e({ start: ['e2e:start'], image: 'relay' }),
  ci: {
    images: [
      ciImage({
        name: 'relay',
        group: 'oss',
        dockerfile: 'Dockerfile',
        image: 'metorial/mte-relay',
        ecr: 'metorial-enterprise-saas/mte-relay',
        canonical: 'ghcr.io/metorial/relay'
      })
    ],
    suite: ciSuite({ name: 'relay', runner: 'compose', profiles: ['infra', 'service'] })
  }
});
