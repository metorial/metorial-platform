import { apiMux } from '@lowerdeck/api-mux';
import { rpcMux } from '@lowerdeck/rpc-server';
import { domainSettings } from '@metorial/shared-settings';
import { adminRPC } from './controllers';
import { endpointApp } from './endpoints';

export type { AdminClient } from './controllers';

let adminMux = rpcMux(
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
    path: '/metorial-ares-admin/api'
  },
  [adminRPC]
);

export let adminApi = apiMux([{ endpoint: adminMux }], endpointApp.fetch as any);
