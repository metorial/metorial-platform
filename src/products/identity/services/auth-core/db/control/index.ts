import { dev, postgres, project } from '@metorial/control';

export default project({
  name: '@mtsrc/auth-core-db',
  group: 'oss',
  dev: dev({
    databases: {
      main: postgres({
        package: '@mtsrc/auth-core-db',
        name: 'ares',
        env: 'DATABASE_URL'
      }),
      sso: postgres({
        package: '@mtsrc/auth-core-db',
        name: 'ares-sso',
        env: 'SSO_DATABASE_URL'
      })
    }
  })
});
