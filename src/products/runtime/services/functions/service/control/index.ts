import {
  bunService,
  ciImage,
  ciSuite,
  dependency,
  dev,
  e2e,
  endpoint,
  fromEnv,
  inherit,
  mergeEnv,
  objectStorage,
  postgres,
  project,
  redis,
  stackMember
} from '@metorial/control';
import { baseDevEnv, devRuntime, pickEnv, ownMigration } from '@metorial/control/presets';

let runtime = devRuntime();

export default project({
  name: '@metorial/function-bay',
  stacks: {
    cloud: stackMember(),
    'on-prem': stackMember({ mode: 'oss' })
  },
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
    ),
    ...(runtime?.functionsDependencies() ?? [])
  ],
  resources: [redis({ REDIS_URL: 'redis://{{HOSTNAME}}:{{PORT}}/0' })],
  dev: dev({
    run: ['dev:start'],
    env: mergeEnv(
      baseDevEnv('oss'),
      pickEnv('ENCRYPTION_KEY'),
      {
        BUNDLE_BUCKET_NAME: 'function-bay-bundles',
        KNATIVE_BOOT_ALLOWANCE_SECONDS: inherit(),
        EGRESS_GATEWAY_PROXY_URL: inherit(),
        NETWORK_LOGS_RPC_SECRET: inherit()
      },
      runtime?.functionsEnv() ?? {
        DEFAULT_PROVIDER: fromEnv('FUNCTION_BAY_DEFAULT_PROVIDER', { default: 'local' }),
        CLUSTER_MANAGER_URL: inherit(),
        CLUSTER_MANAGER_TOKEN_FILE: inherit(),
        RUNTIME_SIGNING_KEY: inherit(),
        RUNTIME_SIGNING_KEY_ID: inherit(),
        NETWORK_LOGS_URL: inherit(),
        NETWORK_LOGS_TOKEN_FILE: inherit()
      }
    ),
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
    tests: ['.'],
    env: {
      OBJECT_STORAGE_URL: 'http://services:52010'
    },
    resources: [objectStorage()]
  }),
  ci: {
    images: [
      ciImage({
        name: 'function-bay',
        group: 'oss',
        image: 'metorial/mte-function-bay',
        ecr: 'metorial-enterprise-saas/mte-function-bay',
        canonical: 'ghcr.io/metorial/function-bay',
        build: bunService({
          ports: [52030],
          health: [
            { port: 52030, path: '/ping' },
            { port: 12121, path: '/' }
          ],
          migrations: [
            ownMigration('function-bay', '@metorial/function-bay', { prefix: 'FUNCTION_BAY' })
          ]
        })
      }),
      ciImage({
        name: 'deflector',
        group: 'oss',
        dockerfile: '../../networking/legacy/deflector/Dockerfile',
        image: 'metorial/mte-deflector',
        ecr: 'metorial-enterprise-saas/mte-deflector',
        canonical: 'ghcr.io/metorial/deflector'
      }),
      ciImage({
        name: 'runtime-egress-gateway',
        group: 'oss',
        dockerfile: '../../networking/service/gateway.Dockerfile',
        image: 'metorial/mte-runtime-egress-gateway',
        ecr: 'metorial-enterprise-saas/mte-runtime-egress-gateway',
        canonical: 'ghcr.io/metorial/runtime-egress-gateway'
      }),
      ciImage({
        name: 'runtime-network-logs',
        group: 'oss',
        dockerfile: '../../networking/service/logstore.Dockerfile',
        image: 'metorial/mte-runtime-network-logs',
        ecr: 'metorial-enterprise-saas/mte-runtime-network-logs',
        canonical: 'ghcr.io/metorial/runtime-network-logs'
      })
    ],
    suite: ciSuite({ name: 'function-bay', groups: 1 })
  }
});
