import { createClient } from '@lowerdeck/rpc-client';
import { createServer, rpcMux, type InferClient } from '@lowerdeck/rpc-server';
import { createFetchRouter } from '@lowerdeck/testing-tools';
import { internalApp } from '../apis/internal/_app';
import { appController } from '../apis/internal/controllers/app';

type ClientOptsLike = Parameters<typeof createClient>[0];

let testRootController = internalApp.controller({ app: appController });
export type TestInternalClient = InferClient<typeof testRootController>;

let fetchRouter = createFetchRouter();
let testInternalRPC = createServer({})(testRootController);
let aresInternalRpc = rpcMux({ path: '/metorial-ares-internal/api' }, [testInternalRPC]);

let defaultEndpoint = 'http://ares-internal.test/metorial-ares-internal/api';

export let ensureAresTestFetch = () => {
  fetchRouter.registerRoute(defaultEndpoint, request => aresInternalRpc.fetch(request));
  fetchRouter.install();
};

export let createAresInternalClient = (opts: Partial<ClientOptsLike> = {}) => {
  ensureAresTestFetch();

  return createClient<TestInternalClient>({
    ...opts,
    endpoint: opts.endpoint ?? defaultEndpoint
  } as ClientOptsLike);
};

export let getAresInternalClient = async (opts: Partial<ClientOptsLike> = {}) =>
  createAresInternalClient(opts);
