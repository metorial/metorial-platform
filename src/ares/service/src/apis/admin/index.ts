import { apiMux } from '@lowerdeck/api-mux';
import { rpcMux } from '@lowerdeck/rpc-server';
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
              'localhost',
              'metorial.test',
              'metorial.com',
              'metorial.work',
              ...(process.env.CORS_DOMAINS?.split(',').map(d => d.trim()) ?? [])
            ]
          },
    path: '/metorial-ares-admin/api'
  },
  [adminRPC]
);

export let adminApi = apiMux([{ endpoint: adminMux }], endpointApp.fetch as any);
