import { createClient } from '@lowerdeck/rpc-client';
import { createServer, rpcMux, type InferClient } from '@lowerdeck/rpc-server';
import { createFetchRouter } from '@lowerdeck/testing-tools';
import { app } from '../controllers/_app';
import { tenantController } from '../controllers/tenant';

type ClientOptsLike = Parameters<typeof createClient>[0];

let testRootController = app.controller({ tenant: tenantController });
export type VoyagerTestClient = InferClient<typeof testRootController>;

let fetchRouter = createFetchRouter();
let testRpc = createServer({})(testRootController);
let voyagerRpc = rpcMux({ path: '/metorial-voyager' }, [testRpc]);

let defaultEndpoint = 'http://voyager.test/metorial-voyager';

export let createTestVoyagerClient = (opts: Partial<ClientOptsLike> = {}) => {
  let endpoint = opts.endpoint ?? defaultEndpoint;
  fetchRouter.registerRoute(endpoint, request => voyagerRpc.fetch(request));
  fetchRouter.install();

  return createClient<VoyagerTestClient>({
    ...opts,
    endpoint
  } as ClientOptsLike);
};

export let voyagerClient = createTestVoyagerClient();
