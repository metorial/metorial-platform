import { apiMux } from '@lowerdeck/api-mux';
import { rpcMux } from '@lowerdeck/rpc-server';
import { domainSettings } from '@metorial/shared-settings';
import { authRPC } from './controllers';
import { endpointApp } from './endpoints';

let authMux = rpcMux(
  {
    cors:
      process.env.ALLOW_CORS == 'true'
        ? { check: () => true }
        : {
            domains: [
              ...domainSettings().apps,
              ...domainSettings().dev,
              ...(process.env.CORS_DOMAINS?.split(',').map(d => d.trim()) ?? [])
            ]
          },
    path: '/metorial-ares/auth-api',
    captureRequestBody: false
  },
  [authRPC]
);

export let authApi = apiMux([{ endpoint: authMux }], endpointApp.fetch as any);
