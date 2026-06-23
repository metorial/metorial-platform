import { createClient } from '@lowerdeck/rpc-client';
import { createFetchRouter } from '@lowerdeck/testing-tools';
import { nebulaApi, type NebulaClient } from '../controllers';

type ClientOptsLike = Parameters<typeof createClient>[0];

let fetchRouter = createFetchRouter();
let registerInMemoryRoute = (endpoint: string) => {
  fetchRouter.registerRoute(endpoint, request => nebulaApi(request, undefined));
};

let defaultEndpoint = 'http://nebula.test/metorial-nebula';

export let createTestNebulaClient = (opts: Partial<ClientOptsLike> = {}) => {
  let endpoint = opts.endpoint ?? defaultEndpoint;
  registerInMemoryRoute(endpoint);
  fetchRouter.install();

  return createClient<NebulaClient>({
    ...opts,
    endpoint
  } as ClientOptsLike);
};

export let nebulaClient = createTestNebulaClient();
export type NebulaTestClient = ReturnType<typeof createTestNebulaClient>;
