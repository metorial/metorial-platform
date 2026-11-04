import { dependency, dev, inherit, mergeEnv, postgres, project } from '@metorial/control';
import { baseDevEnv, pickEnv, services, sharedDatabases } from '@metorial/control/presets';

export default project({
  name: '@metorial/db',
  group: 'oss',
  dependencies: [
    dependency('@metorial/object-storage')
      .noStart()
      .env('api', 'OBJECT_STORAGE_URL', 'http://{{HOSTNAME}}:{{PORT}}')
  ],
  dev: dev({
    env: mergeEnv(baseDevEnv('oss'), pickEnv('PORTAL_API_PORT', 'SCOUT_URL'), {
      EMAIL_FROM: inherit(),
      EMAIL_FROM_NAME: inherit(),
      CONSUMER_TOKEN_SECRET: 'consumer-token-secret',
      CONSUMER_SESSION_SECRET: 'consumer-token-secret',
      SIGNED_DOWNLOAD_URL_TOKEN_SECRET: 'dev-cargo-download-token-secret',
      METORIAL_REGION: 'dev',
      DOWNLOAD_PUBLIC_URL: services.files.url(),
      PORTAL_HOST_TEMPLATE: services.dashboard.url('/p/{portalId}'),
      PORTAL_REDIRECT_DOMAINS: '{{HOSTNAME}}',
      REDIS_URL: 'redis://localhost:{{CONTROL_PORT_REDIS}}/0',
      SYNTHESIS_API_URL: services.synthesis.url('/metorial-synthesis'),
      PROVIDER_OAUTH_TICKET_SECRET: 'provider-oauth-ticket-secret',
      AUTH_TICKET_SECRET: 'auth-ticket-secret',
      ENCRYPTION_SECRET: 'encryption-secret',
      FILES_BUCKET_NAME: 'mte-files',
      USAGE_MONGO_URI:
        'mongodb://mongo:mongo@localhost:{{CONTROL_PORT_MONGO}}/?authSource=admin',
      API_URL: services.coreApi.url(),
      FILES_URL: services.files.url(),
      APP_URL: services.dashboard.url(),
      DASHBOARD_FRONTEND_HOST: services.dashboard.url(),
      PORTALS_URL: services.dashboard.url(),
      AWS_ACCESS_KEY_ID: inherit(),
      AWS_SECRET_ACCESS_KEY: inherit(),
      AWS_REGION: inherit(),
      AWS_ACCOUNT_ID: inherit(),
      ARES_INTERNAL_URL: services.aresInternal.url('/metorial-ares-internal/api'),
      ARES_AUTH_URL: services.aresAuth.url(),
      RELAY_URL: services.relay.url('/metorial-relay'),
      EMAIL_NAME: 'Metorial DEV',
      EMAIL_ADDRESS: 'dev@metorial.com',
      SUBSPACE_SOLUTION: 'metorial-dev',
      VOYAGER_URL: services.voyager.url('/metorial-voyager'),
      ORIGIN_URL: services.origin.url('/metorial-origin'),
      CODE_BUCKET_SERVICE_URL: '{{HOSTNAME}}:5050',
      NEBULA_API_URL: services.nebula.url('/metorial-nebula'),
      AI_GATEWAY_API_KEY: inherit(),
      SCOUT_TOKEN: inherit(),
      EXTERNAL_MULTI_REGION_ENDPOINT: services.multiRegion.url(),
      INTERNAL_MULTI_REGION_ENDPOINT: services.multiRegion.url()
    }),
    databases: {
      main: sharedDatabases.metorialEnterprise,
      subspace: postgres({
        package: '@metorial/db',
        name: 'subspace',
        env: 'SUBSPACE_DATABASE_URL'
      })
    }
  })
});
