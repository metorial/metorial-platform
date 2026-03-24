import { createFetchRouter } from '@lowerdeck/testing-tools';
import { rpcMux } from '@lowerdeck/rpc-server';
import { createShuttleClient } from '../../../clients/typescript/src/controller';
import { ShuttleRPC } from '../apis/controllers';

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
const shuttleRpc = rpcMux({ path: '/metorial-shuttle' }, [ShuttleRPC]);
const registerInMemoryRoute = (endpoint: string) => {
  fetchRouter.registerRoute(endpoint, request => shuttleRpc.fetch(request));
};

const defaultEndpoint = 'http://shuttle.test/metorial-shuttle';

export const createTestShuttleClient = (opts: Partial<ClientOptsLike> = {}) => {
  const endpoint = opts.endpoint ?? defaultEndpoint;
  registerInMemoryRoute(endpoint);
  fetchRouter.install();

  return createShuttleClient({
    ...opts,
    endpoint
  } as ClientOptsLike);
};

export const shuttleClient = createTestShuttleClient();
export type ShuttleTestClient = ReturnType<typeof createTestShuttleClient>;
