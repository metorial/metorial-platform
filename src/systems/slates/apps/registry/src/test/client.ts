import { createClient } from '@mtsrc/rpc-client';
import { createFetchRouter } from '@mtsrc/testing-tools';
import { slatesRegistryApi, type SlatesRegistryClient } from '../apis/internal';

type ClientOptsLike = Parameters<typeof createClient>[0];

let fetchRouter = createFetchRouter();

let registerInMemoryRoute = (endpoint: string) => {
  fetchRouter.registerRoute(endpoint, request => slatesRegistryApi(request, undefined));
};

let defaultEndpoint = 'http://slates-registry.test/slates-registry';

export let createTestRegistryClient = (opts: Partial<ClientOptsLike> = {}) => {
  let endpoint = opts.endpoint ?? defaultEndpoint;
  registerInMemoryRoute(endpoint);
  fetchRouter.install();

  return createClient<SlatesRegistryClient>({
    ...opts,
    endpoint
  } as ClientOptsLike);
};

export let registryClient = createTestRegistryClient();
export type RegistryTestClient = ReturnType<typeof createTestRegistryClient>;
