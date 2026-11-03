import {
  bunService,
  dependency,
  dockerfile,
  dev,
  e2e,
  healthCheck,
  mergeEnv,
  mongodb,
  nats,
  postgres,
  project
} from '@metorial/control';
import {
  baseDevEnv,
  migrations,
  pickEnv,
  platformEnv,
  sharedDatabases
} from '@metorial/control/presets';

export default project({
  name: '@metorial-subspace/app-worker',
  group: 'oss',
  mode: 'oss',
  dependencies: [
    dependency('@metorial/object-storage')
      .noStart()
      .env('api', 'OBJECT_STORAGE_URL', 'http://{{HOSTNAME}}:{{PORT}}')
  ],
  resources: [nats({ NATS_URL: 'nats://{{HOSTNAME}}:{{PORT}}' })],
  dev: dev({
    run: ['dev:start'],
    env: mergeEnv(
      baseDevEnv('oss'),
      platformEnv(),
      pickEnv(
        'INTEGRATIONS_API_URL',
        'INTEGRATIONS_UI_URL',
        'PORTAL_API_PORT',
        'SLATE_ATTACHMENT_SIGNING_SECRET'
      ),
      {
        SCOUT_URL: 'https://scout-fra-fly-prod.metorial-enterprise.com/metorial-scout'
      }
    ),
    databases: {
      subspace: sharedDatabases.subspace,
      main: sharedDatabases.metorialOss,
      federation: sharedDatabases.metorialEnterpriseFederation,
      payment: postgres({
        package: '@metorial-subspace/app-worker',
        name: 'metorial-enterprise-payment',
        env: 'PAYMENT_DATABASE_URL'
      }),
      global: sharedDatabases.metorialOssGlobal,
      usage: mongodb({
        package: '@metorial-subspace/app-worker',
        name: 'metorial-usage',
        env: 'USAGE_MONGO_URL'
      })
    }
  }),
  health: [healthCheck(12131, '/')],
  e2e: e2e({
    start: ['e2e:start'],
    image: 'subspace-worker',
    env: {
      OBJECT_STORAGE_URL: 'http://services:52010',
      HEALTH_PORT: '12131',
      METORIAL_ENABLED_FLAGS: '*'
    }
  }),
  ci: {
    dockerfiles: [
      dockerfile({
        build: bunService({
          include: ['@metorial/db', '@metorial/multi-region', '@metorial-subspace/db'],
          health: [{ port: 12121, path: '/' }],
          migrations: [migrations.core, migrations.global, migrations.subspace]
        })
      })
    ]
  }
});
