import { createClient } from '@lowerdeck/rpc-client';
import { rpcMux } from '@lowerdeck/rpc-server';
import { createFetchRouter } from '@lowerdeck/testing-tools';
import { OriginRPC, type OriginClient } from '../controllers';

type ClientOptsLike = Parameters<typeof createClient>[0];

let fetchRouter = createFetchRouter();
let originRpc = rpcMux({ path: '/metorial-origin' }, [OriginRPC]);

let registerInMemoryRoute = (endpoint: string) => {
  fetchRouter.registerRoute(endpoint, request => originRpc.fetch(request));
};

let defaultEndpoint = 'http://origin.test/metorial-origin';

export let createTestOriginClient = (opts: Partial<ClientOptsLike> = {}) => {
  let endpoint = opts.endpoint ?? defaultEndpoint;
  registerInMemoryRoute(endpoint);
  fetchRouter.install();

  return createClient<OriginClient>({
    ...opts,
    endpoint
  } as ClientOptsLike);
};

export let originClient = createTestOriginClient();
export type OriginTestClient = ReturnType<typeof createTestOriginClient>;
