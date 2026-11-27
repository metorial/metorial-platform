import { dependency, dev, endpoint, mergeEnv, project } from '@metorial/control';
import { baseDevEnv, pickEnv } from '@metorial/control/presets';

export default project({
  name: '@metorial/app-dashboard',
  group: 'oss',
  mode: 'oss',
  endpoints: {
    web: endpoint(3300).listenEnv('PORT')
  },
  dependencies: [
    dependency('@metorial/app-api').env(
      'portal',
      'VITE_CUSTOM_PORTAL_API_URL',
      'http://{{HOSTNAME}}:{{PORT}}/portal-api'
    )
  ],
  dev: dev({
    run: ['dev:start'],
    env: mergeEnv(
      baseDevEnv('oss'),
      pickEnv(
        'VITE_API_EXPLORER_URL',
        'VITE_EXPLORER_URL',
        'VITE_EXPLORER_V2_URL',
        'VITE_FEDERATION_INSTANCES',
        'VITE_METORIAL_ENV',
        'VITE_SHELL_URL'
      )
    )
  })
});
