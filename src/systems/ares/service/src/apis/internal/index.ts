import { apiMux } from '@lowerdeck/api-mux';
import { rpcMux } from '@lowerdeck/rpc-server';
import { internalRPC } from './controllers';

export type { InternalClient } from './controllers';

let internalMux = rpcMux(
  {
    cors: { check: () => true },
    path: '/metorial-ares-internal/api'
  },
  [internalRPC]
);

export let internalApi = apiMux([{ endpoint: internalMux }]);
