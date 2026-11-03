import {
  ciImage,
  ciSuite,
  dependency,
  dev,
  e2e,
  endpoint,
  mergeEnv,
  postgres,
  project,
  redis
} from '@metorial/control';
import { baseDevEnv, pickEnv } from '@metorial/control/presets';

export default project({
  name: '@metorial/forge',
  group: 'oss',
  endpoints: {
    api: endpoint(52020).health('/ping').listenEnv('FORGE_API_PORT')
  },
  dependencies: [
    dependency('@metorial/object-storage')
      .noStart()
      .env('api', 'OBJECT_STORAGE_URL', 'http://{{HOSTNAME}}:{{PORT}}')
  ],
  resources: [redis({ REDIS_URL: 'redis://{{HOSTNAME}}:{{PORT}}/0' })],
  dev: dev({
    run: ['dev:start'],
    env: mergeEnv(baseDevEnv('oss'), pickEnv('DEFAULT_PROVIDER', 'ENCRYPTION_KEY'), {
      ARTIFACT_BUCKET_NAME: 'artifacts',
      LOG_BUCKET_NAME: 'logs'
    }),
    databases: {
      main: postgres({ package: '@metorial/forge', name: 'forge', env: 'DATABASE_URL' })
    }
  }),
  e2e: e2e({
    start: ['e2e:start'],
    image: 'forge',
    env: {
      OBJECT_STORAGE_URL: 'http://services:52010'
    }
  }),
  ci: {
    images: [
      ciImage({
        name: 'forge',
        group: 'oss',
        dockerfile: 'Dockerfile',
        image: 'metorial/mte-forge',
        ecr: 'metorial-enterprise-saas/mte-forge',
        canonical: 'ghcr.io/metorial/forge'
      })
    ],
    suite: ciSuite({ name: 'forge', runner: 'compose', profiles: ['infra', 'service'] })
  }
});
