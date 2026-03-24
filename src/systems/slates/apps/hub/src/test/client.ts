import { createSlatesHubInternalClient } from '@metorial-mono/slates-hub-client';
import { rpcMux } from '@lowerdeck/rpc-server';
import { createFetchRouter } from '@lowerdeck/testing-tools';
import { slatesHubRPC } from '../apis/internal';

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
const slatesHubRpc = rpcMux({ path: '/slates-hub' }, [slatesHubRPC]);
const registerInMemoryRoute = (endpoint: string) => {
  fetchRouter.registerRoute(endpoint, request => slatesHubRpc.fetch(request));
};

const defaultEndpoint = 'http://slates-hub.test/slates-hub';

export const createTestHubClient = (opts: Partial<ClientOptsLike> = {}) => {
  const endpoint = opts.endpoint ?? defaultEndpoint;
  registerInMemoryRoute(endpoint);
  fetchRouter.install();

  return createSlatesHubInternalClient({
    ...opts,
    endpoint
  } as ClientOptsLike);
};

export const slatesHubClient = createTestHubClient();
export type SlatesHubTestClient = ReturnType<typeof createTestHubClient>;
