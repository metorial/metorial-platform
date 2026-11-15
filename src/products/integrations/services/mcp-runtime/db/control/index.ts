import { dev, postgres, project } from '@metorial/control';

export default project({
  name: '@mtsrc/mcp-runtime-db',
  group: 'oss',
  dev: dev({
    databases: {
      main: postgres({
        package: '@mtsrc/mcp-runtime-db',
        name: 'shuttle',
        env: 'DATABASE_URL'
      })
    }
  })
});
