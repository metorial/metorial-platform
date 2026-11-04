import { ciImage, dev, endpoint, mergeEnv, project, stackMember } from '@metorial/control';
import { services } from '@metorial/control/presets';

export default project({
  name: '@metorial/object-storage',
  group: 'oss',
  stacks: {
    'on-prem': stackMember({
      development: { container: true },
      env: { OBJECT_STORE__BACKEND__ROOT_PATH: '/app/data' },
      volumes: { data: '/app/data' }
    })
  },
  endpoints: {
    api: endpoint(52010).health('/health').listenEnv('OBJECT_STORE__SERVER__PORT')
  },
  dev: dev({
    run: ['dev:start'],
    env: mergeEnv({
      RUST_LOG: 'info',
      OBJECT_STORE__SERVER__HOST: '0.0.0.0',
      OBJECT_STORE__BACKEND__TYPE: 'local',
      OBJECT_STORE__BACKEND__ROOT_PATH: './.data',
      OBJECT_STORE__BACKEND__PUBLIC_URL: services.objectStorage.url()
    })
  }),
  ci: {
    images: [
      ciImage({
        name: 'object-store',
        group: 'oss',
        dockerfile: 'Dockerfile',
        image: 'metorial/mte-object-store',
        ecr: 'metorial-enterprise-saas/mte-object-store',
        canonical: 'ghcr.io/metorial/mte-object-store'
      })
    ]
  }
});
