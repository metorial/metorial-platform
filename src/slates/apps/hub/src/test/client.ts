import { createClient } from '@lowerdeck/rpc-client';
import { createFetchRouter } from '@lowerdeck/testing-tools';
import type { SlatesHubClient } from '../apis/internal';
import { slatesHubApi } from '../apis/internal';

type ClientOpts = Parameters<typeof createClient>[0];

export let createSlatesHubInternalClient = (o: ClientOpts): SlatesHubClient =>
  createClient<SlatesHubClient>(o);

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
  fetchRouter.registerRoute(endpoint, request => slatesHubApi(request, undefined));
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
