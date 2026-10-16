import { createClient } from '@lowerdeck/rpc-client';
import { createFetchRouter } from '@lowerdeck/testing-tools';
import { functionBayApi, type FunctionBayClient } from '../controllers';

type ClientOptsLike = {
  endpoint: string;
  headers?: Record<string, string | undefined>;
  getHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
  onRequest?: (d: {
    endpoint: string;
    name: string;
    payload: any;
    headers: Record<string, string | undefined>;
    query?: Record<string, string | undefined>;
  }) => any;
};

let fetchRouter = createFetchRouter();
let registerInMemoryRoute = (endpoint: string) => {
  fetchRouter.registerRoute(endpoint, request => functionBayApi(request, undefined));
};

let defaultEndpoint = 'http://function-bay.test/metorial-function-bay';

export let createTestFunctionBayClient = (opts: Partial<ClientOptsLike> = {}) => {
  let endpoint = opts.endpoint ?? defaultEndpoint;
  registerInMemoryRoute(endpoint);
  fetchRouter.install();

  return createClient<FunctionBayClient>({
    ...opts,
    endpoint
  } as ClientOptsLike);
};

export let functionBayClient = createTestFunctionBayClient();
export type FunctionBayTestClient = ReturnType<typeof createTestFunctionBayClient>;
