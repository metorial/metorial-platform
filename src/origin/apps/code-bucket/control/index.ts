import {
  ciImage,
  dependency,
  dev,
  e2e,
  endpoint,
  mergeEnv,
  project,
  redis,
  stackMember
} from '@metorial/control';
import { baseDevEnv, pickEnv } from '@metorial/control/presets';

export default project({
  name: '@metorial/code-bucket-service-generated',
  stacks: {
    cloud: stackMember(),
    'on-prem': stackMember({ mode: 'oss', development: { container: true } })
  },
  group: 'oss',
  endpoints: {
    http: endpoint(52091)
      .health('/files', 401)
      .env('CODE_BUCKET_HTTP_ADDRESS', ':{{BIND_PORT}}')
      .env('CODE_BUCKET_EDITOR_API_URL', 'http://{{HOSTNAME}}:{{PORT}}'),
    workspace: endpoint(52092).env('CODE_BUCKET_WORKSPACE_ADDRESS', ':{{BIND_PORT}}'),
    rpc: endpoint(5050).protocol('h2c').env('CODE_BUCKET_RPC_ADDRESS', ':{{BIND_PORT}}')
  },
  dependencies: [
    dependency('@metorial/object-storage')
      .noStart()
      .env('api', 'CODE_BUCKET_OBJECT_STORAGE_ENDPOINT', 'http://{{HOSTNAME}}:{{PORT}}')
  ],
  resources: [redis({ CODE_BUCKET_REDIS_URL: 'redis://{{HOSTNAME}}:{{PORT}}/0' })],
  dev: dev({
    run: ['dev:start'],
    env: mergeEnv(baseDevEnv('oss'), pickEnv('CODE_BUCKET_OBJECT_STORAGE_BUCKET'), {
      CODE_BUCKET_JWT_SECRET: 'origin-code-bucket-dev-secret'
    })
  }),
  e2e: e2e({
    start: ['e2e:start'],
    image: 'code-bucket',
    env: {
      CODE_BUCKET_JWT_SECRET: 'origin-code-bucket-e2e-secret',
      CODE_BUCKET_OBJECT_STORAGE_BUCKET: 'code-bucket',
      CODE_BUCKET_OBJECT_STORAGE_ENDPOINT: 'http://services:52010'
    }
  }),
  ci: {
    images: [
      ciImage({
        name: 'code-bucket',
        group: 'oss',
        dockerfile: 'Dockerfile',
        image: 'metorial/mte-code-bucket',
        ecr: 'metorial-enterprise-saas/mte-code-bucket',
        canonical: 'ghcr.io/metorial/mte-code-bucket'
      })
    ]
  }
});
