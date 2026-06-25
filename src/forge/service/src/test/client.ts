import { createClient } from '@lowerdeck/rpc-client';
import { createFetchRouter } from '@lowerdeck/testing-tools';
import { forgeApi } from '../controllers';
import type { ForgeClient } from '../controllers';

type ClientOptsLike = Parameters<typeof createClient>[0];

const fetchRouter = createFetchRouter();
const registerInMemoryRoute = (endpoint: string) => {
  fetchRouter.registerRoute(endpoint, request => forgeApi(request, undefined));
};

const defaultEndpoint = 'http://forge.test/metorial-forge';

export const createTestForgeClient = (opts: Partial<ClientOptsLike> = {}) => {
  const endpoint = opts.endpoint ?? defaultEndpoint;
  registerInMemoryRoute(endpoint);
  fetchRouter.install();

  return createClient<ForgeClient>({
    ...opts,
    endpoint
  } as ClientOptsLike);
};

export const forgeClient = createTestForgeClient();
export type ForgeTestClient = ReturnType<typeof createTestForgeClient>;
