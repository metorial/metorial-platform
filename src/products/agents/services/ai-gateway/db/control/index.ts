import { dev, postgres, project } from '@metorial/control';

export default project({
  name: '@mtsrc/ai-gateway-db',
  group: 'oss',
  dev: dev({
    databases: {
      main: postgres({
        package: '@mtsrc/ai-gateway-db',
        name: 'ai-gateway',
        env: 'AI_GATEWAY_DATABASE_URL'
      })
    }
  })
});
