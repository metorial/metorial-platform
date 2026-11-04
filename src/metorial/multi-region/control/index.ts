import { dev, postgres, project } from '@metorial/control';

export default project({
  name: '@metorial/multi-region',
  group: 'oss',
  dev: dev({
    databases: {
      global: postgres({
        package: '@metorial/multi-region',
        name: 'metorial-enterprise-global',
        env: 'GLOBAL_DATABASE_URL'
      })
    }
  })
});
