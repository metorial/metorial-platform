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
  name: '@metorial/function-bay',
  group: 'oss',
  endpoints: {
    api: endpoint(52030).health('/ping').listenEnv('FUNCTION_BAY_API_PORT')
  },
  dependencies: [
    dependency('@metorial/object-storage')
      .noStart()
      .env('api', 'OBJECT_STORAGE_URL', 'http://{{HOSTNAME}}:{{PORT}}'),
    dependency('@metorial/forge').env(
      'api',
      'FORGE_API_URL',
      'http://{{HOSTNAME}}:{{PORT}}/metorial-forge'
    )
  ],
  resources: [redis({ REDIS_URL: 'redis://{{HOSTNAME}}:{{PORT}}/0' })],
  dev: dev({
    run: ['dev:start'],
    env: mergeEnv(baseDevEnv('oss'), pickEnv('DEFAULT_PROVIDER', 'ENCRYPTION_KEY'), {
      BUNDLE_BUCKET_NAME: 'function-bay-bundles'
    }),
    databases: {
      main: postgres({
        package: '@metorial/function-bay',
        name: 'function-bay',
        env: 'DATABASE_URL'
      })
    }
  }),
  e2e: e2e({
    start: ['e2e:start'],
    image: 'function-bay',
    env: {
      OBJECT_STORAGE_URL: 'http://services:52010'
    }
  }),
  ci: {
    images: [
      ciImage({
        name: 'function-bay',
        group: 'oss',
        dockerfile: 'Dockerfile',
        image: 'metorial/mte-function-bay',
        ecr: 'metorial-enterprise-saas/mte-function-bay',
        canonical: 'ghcr.io/metorial/function-bay'
      }),
      ciImage({
        name: 'deflector',
        group: 'oss',
        dockerfile: '../deflector/Dockerfile',
        image: 'metorial/mte-deflector',
        ecr: 'metorial-enterprise-saas/mte-deflector',
        canonical: 'ghcr.io/metorial/deflector'
      }),
      ciImage({
        name: 'function-bay-observer',
        group: 'oss',
        dockerfile: '../observer/Dockerfile',
        image: 'metorial/mte-function-bay-observer',
        ecr: 'metorial-enterprise-saas/mte-function-bay-observer',
        canonical: 'ghcr.io/metorial/function-bay-observer'
      })
    ],
    suite: ciSuite({ name: 'function-bay', runner: 'compose', profiles: ['infra', 'service'] })
  }
});
