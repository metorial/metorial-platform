import { apiMux } from '@lowerdeck/api-mux';
import { createServer, type InferClient, rpcMux } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { callbackEventController } from './callbackEvent';

export let rootSubspaceInternal = app.controller({
  callbackEvent: callbackEventController
});

export let subspaceInternalRPC = createServer({})(rootSubspaceInternal);

export let subspaceInternalApi = apiMux([
  { endpoint: rpcMux({ path: '/subspace-internal' }, [subspaceInternalRPC]) }
]);

export type SubspaceInternalClient = InferClient<typeof rootSubspaceInternal>;
