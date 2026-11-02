import { apiMux } from '@lowerdeck/api-mux';
import { rpcMux } from '@lowerdeck/rpc-server';
import { aresCorsDomains } from '../../lib/corsDomains';
import { authRPC } from './controllers';
import { endpointApp } from './endpoints';

let authMux = rpcMux(
  {
    cors:
      process.env.ALLOW_CORS == 'true'
        ? { check: () => true }
        : {
            domains: aresCorsDomains()
          },
    path: '/metorial-ares/auth-api',
    captureRequestBody: false
  },
  [authRPC]
);

export let authApi = apiMux([{ endpoint: authMux }], endpointApp.fetch as any);
