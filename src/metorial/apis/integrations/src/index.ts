import { apiMux } from '@lowerdeck/api-mux';
import { rpcMux } from '@lowerdeck/rpc-server';
import { isIntegrationsCorsOriginAllowed } from './cors';
import { env } from './env';
import { subspaceFrontendRPC, type IntegrationsClient } from './internal';
import { integrationsPublicApi } from './public';

let integrationsFetch = apiMux(
  [
    {
      endpoint: rpcMux(
        {
          path: '/subspace-public/internal-api',
          cors: {
            check: origin =>
              isIntegrationsCorsOriginAllowed({
                origin,
                integrationsUiUrl: env.service.INTEGRATIONS_UI_URL,
                corsDomains: env.service.CORS_DOMAINS,
                allowCors: env.service.ALLOW_CORS,
                isDevelopment: process.env.NODE_ENV !== 'production'
              })
          }
        },
        [subspaceFrontendRPC]
      )
    }
  ],
  integrationsPublicApi.fetch as any
);

export let integrationsApi = {
  fetch: integrationsFetch
};

export type { IntegrationsClient };
export { integrationsRedirectUrl, integrationsUrl } from './urls';
export { isIntegrationsCorsOriginAllowed } from './cors';
