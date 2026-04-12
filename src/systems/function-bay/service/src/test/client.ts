import { createFunctionBayClient } from '../../../clients/typescript/src/index';
import { createFetchRouter } from '@lowerdeck/testing-tools';
import { functionBayApi } from '../controllers';

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

const fetchRouter = createFetchRouter();
const registerInMemoryRoute = (endpoint: string) => {
  fetchRouter.registerRoute(endpoint, request => functionBayApi(request, undefined));
};

const defaultEndpoint = 'http://function-bay.test/metorial-function-bay';

export const createTestFunctionBayClient = (opts: Partial<ClientOptsLike> = {}) => {
  const endpoint = opts.endpoint ?? defaultEndpoint;
  registerInMemoryRoute(endpoint);
  fetchRouter.install();

  return createFunctionBayClient({
    ...opts,
    endpoint
  } as ClientOptsLike);
};

export const functionBayClient = createTestFunctionBayClient();
export type FunctionBayTestClient = ReturnType<typeof createTestFunctionBayClient>;
