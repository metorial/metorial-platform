import {
  bunService,
  ciImage,
  ciSuite,
  dependency,
  dev,
  e2e,
  endpoint,
  mergeEnv,
  objectStorage,
  postgres,
  project,
  redis,
  stackMember
} from '@metorial/control';
import { baseDevEnv, ownMigration } from '@metorial/control/presets';

export default project({
  name: '@metorial/slates-registry',
  stacks: {
    cloud: stackMember(),
    'on-prem': stackMember({ mode: 'oss' })
  },
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
      PACKAGE_BUCKET_NAME: 'package-bucket',
      SLATES_REGISTRY_MODE: 'mirror',
      SLATES_SIGNATURE_VERIFICATION: 'disabled',
      SLATES_UPSTREAM_REGISTRIES: JSON.stringify([
        {
          url: 'https://slates.metorial-enterprise.com',
          subRegistryId: 'metorial-saas-staging'
        }
      ])
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
    tests: ['.'],
    env: {
      OBJECT_STORAGE_URL: 'http://services:52010',
      PACKAGE_BUCKET_NAME: 'package-bucket'
    },
    resources: [objectStorage()]
  }),
  ci: {
    images: [
      ciImage({
        name: 'slates-registry',
        group: 'oss',
        image: 'metorial/mte-slates-registry',
        ecr: 'metorial-enterprise-saas/mte-slates-registry',
        canonical: 'ghcr.io/metorial/slates-registry',
        build: bunService({
          tasks: ['prisma:generate', 'server:build', 'admin:build'],
          ports: [52040, 52041, 52042],
          health: [
            { port: 52040, path: '/ping' },
            { port: 52041, path: '/ping' },
            { port: 12121, path: '/' }
          ],
          migrations: [
            ownMigration('slates-registry', '@metorial/slates-registry', {
              prefix: 'SLATES_REGISTRY',
              path: 'prisma/schema.prisma'
            })
          ]
        })
      })
    ],
    suite: ciSuite({ name: 'slates-registry', groups: 1 })
  }
});
