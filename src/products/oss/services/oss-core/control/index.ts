import {
  bunService,
  ciSuite,
  dependency,
  dev,
  dockerfile,
  e2e,
  endpoint,
  mergeEnv,
  mongodb,
  nats,
  objectStorage,
  project,
  stackMember
} from '@metorial/control';
import {
  baseDevEnv,
  migrations,
  pickEnv,
  platformEnv,
  sharedDatabases
} from '@metorial/control/presets';

export default project({
  name: '@metorial/app-api',
  stacks: {
    'on-prem': stackMember()
  },
  group: 'oss',
  mode: 'oss',
  endpoints: {
    api: endpoint(4310).health('/ping').listenEnv('API_PORT'),
    mcp: endpoint(4311).health('/ping').listenEnv('MCP_PORT'),
    portal: endpoint(4315),
    integrations: endpoint(4316).health('/ping').listenEnv('INTEGRATIONS_API_PORT'),
    subspaceInternal: endpoint(4317).health('/ping').listenEnv('SUBSPACE_INTERNAL_API_PORT'),
    files: endpoint(4318).health('/ping').listenEnv('FILES_PORT')
  },
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
        'GENESIS_INTERNAL_URL',
        'INTEGRATIONS_API_URL',
        'INTEGRATIONS_UI_URL',
        'OUTPOST_KEY_ENCRYPTION_SECRET',
        'PORTAL_API_PORT',
        'SANDBOX_REGIONS',
        'SANDBOX_SIGNATURE_CREDENTIALS',
        'SCOUT_URL',
        'SLATE_ATTACHMENT_SIGNING_SECRET'
      )
    ),
    databases: {
      main: sharedDatabases.metorialOss,
      subspace: sharedDatabases.subspace,
      global: sharedDatabases.metorialOssGlobal,
      usage: mongodb({
        package: '@metorial/app-api',
        name: 'metorial-usage',
        env: 'USAGE_MONGO_URL'
      })
    }
  }),
  e2e: e2e({
    start: ['e2e:start'],
    image: 'app-api',
    tests: [
      '../../../../metorial/products/*/modules/*',
      '../../../../platform/modules/*',
      '../../../*/modules/*',
      '../../../*/apis/*',
      '../../../../metorial/apis/*'
    ],
    services: [
      '@mtsrc/mcp-runtime-service',
      '@mtsrc/search-service',
      '@mtsrc/email-service',
      '@metorial-subspace/app-worker'
    ],
    healthTimeout: 300,
    env: {
      OBJECT_STORAGE_URL: 'http://services:52010',
      AWS_ACCESS_KEY_ID: 'e2e',
      AWS_SECRET_ACCESS_KEY: 'e2e',
      AWS_REGION: 'us-east-1',
      AWS_ACCOUNT_ID: '000000000000',
      RELAY_URL: 'http://localhost:52110/metorial-relay',
      METORIAL_ENABLED_FLAGS: '*',
      SKILL_SYNC_RECONCILER_CRONS_ENABLED: 'false'
    },
    resources: [objectStorage()]
  }),
  ci: {
    dockerfiles: [
      dockerfile({
        build: bunService({
          tasks: ['prisma:generate', 'oss:server:build'],
          include: ['@metorial/db', '@metorial/multi-region', '@metorial-subspace/db'],
          heapMb: 15360,
          ports: [4310, 4311, 4315, 4316, 4317, 4318],
          health: [{ port: 4310, path: '/ping' }],
          migrations: [migrations.core, migrations.global, migrations.subspace]
        })
      })
    ],
    suite: ciSuite({ name: 'metorial', groups: 4 })
  }
});
