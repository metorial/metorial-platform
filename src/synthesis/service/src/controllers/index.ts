import { apiMux } from '@lowerdeck/api-mux';
import { createServer, rpcMux, type InferClient } from '@lowerdeck/rpc-server';
import { app } from './_app';

export let rootController = app.controller({});

export let SynthesisRPC = createServer({})(rootController);
export let SynthesisApi = apiMux([
  { endpoint: rpcMux({ path: '/metorial-synthesis' }, [SynthesisRPC]) }
]);

export type SynthesisClient = InferClient<typeof rootController>;
