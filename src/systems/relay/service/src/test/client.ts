import { createClient } from '@mtsrc/rpc-client';
import { createServer, rpcMux, type InferClient } from '@mtsrc/rpc-server';
import { createFetchRouter } from '@mtsrc/testing-tools';
import { app } from '../controllers/_app';
import { senderController } from '../controllers/sender';

type ClientOptsLike = Parameters<typeof createClient>[0];

let testRootController = app.controller({ sender: senderController });
export type RelayTestClient = InferClient<typeof testRootController>;

let fetchRouter = createFetchRouter();
let testRpc = createServer({})(testRootController);
let relayRpc = rpcMux({ path: '/metorial-relay' }, [testRpc]);

let defaultEndpoint = 'http://relay.test/metorial-relay';

export let createTestRelayClient = (opts: Partial<ClientOptsLike> = {}) => {
  let endpoint = opts.endpoint ?? defaultEndpoint;
  fetchRouter.registerRoute(endpoint, request => relayRpc.fetch(request));
  fetchRouter.install();

  return createClient<RelayTestClient>({
    ...opts,
    endpoint
  } as ClientOptsLike);
};

export let relayClient = createTestRelayClient();
