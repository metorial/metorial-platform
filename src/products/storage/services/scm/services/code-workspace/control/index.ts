import { dev, endpoint, project } from '@metorial/control';

export default project({
  name: '@mtsrc/scm-code-workspace',
  group: 'oss',
  endpoints: {
    web: endpoint(3302).listenEnv('PORT')
  },
  dev: dev({ prepare: ['setup_vscode'], run: ['dev:start'] })
});
