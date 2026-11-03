import {
  ciImage,
  dependency,
  dev,
  e2e,
  endpoint,
  mergeEnv,
  postgres,
  project,
  redis
} from '@metorial/control';
import { baseDevEnv } from '@metorial/control/presets';

export default project({
  name: '@metorial/slates-registry',
  group: 'oss',
  endpoints: {
    public: endpoint(52040)
      .health('/ping')
      .listenEnv('SLATES_REGISTRY_PUBLIC_PORT')
      .env('SERVICE_PUBLIC_URL', 'http://{{HOSTNAME}}:{{PORT}}'),
    internal: endpoint(52041).listenEnv('SLATES_REGISTRY_INTERNAL_PORT'),
    admin: endpoint(52042)
      .listenEnv('SLATES_REGISTRY_ADMIN_PORT')
      .link({ label: 'Slates Registry Admin', group: 'admin' })
  },
  dependencies: [
    dependency('@metorial/object-storage')
      .noStart()
      .env('api', 'OBJECT_STORAGE_URL', 'http://{{HOSTNAME}}:{{PORT}}')
  ],
  resources: [redis({ REDIS_URL: 'redis://{{HOSTNAME}}:{{PORT}}/0' })],
  dev: dev({
    prepare: ['admin:build'],
    run: ['dev:start'],
    env: mergeEnv(baseDevEnv('oss'), {
      PACKAGE_BUCKET_NAME: 'package-bucket'
    }),
    databases: {
      main: postgres({
        package: '@metorial/slates-registry',
        name: 'slates-registry',
        env: 'DATABASE_URL'
      })
    }
  }),
  e2e: e2e({
    start: ['e2e:start'],
    image: 'slates-registry',
    env: {
      OBJECT_STORAGE_URL: 'http://services:52010'
    }
  }),
  ci: {
    images: [
      ciImage({
        name: 'slates-registry',
        group: 'oss',
        dockerfile: 'Dockerfile',
        image: 'metorial/mte-slates-registry',
        ecr: 'metorial-enterprise-saas/mte-slates-registry',
        canonical: 'ghcr.io/metorial/slates-registry'
      })
    ]
  }
});
