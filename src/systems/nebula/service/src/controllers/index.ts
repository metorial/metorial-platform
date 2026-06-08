import { apiMux } from '@lowerdeck/api-mux';
import { createServer, rpcMux, type InferClient } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { consumerController } from './consumer';
import { keyProviderController } from './keyProvider';
import { keyProviderErrorController } from './keyProviderError';
import { secretController } from './secret';
import { tenantController } from './tenant';

export let rootController = app.controller({
  tenant: tenantController,
  consumer: consumerController,
  keyProvider: keyProviderController,
  keyProviderError: keyProviderErrorController,
  secret: secretController
});

export let nebulaRPC = createServer({})(rootController);
export let nebulaApi = apiMux([{ endpoint: rpcMux({ path: '/metorial-nebula' }, [nebulaRPC]) }]);

export type NebulaClient = InferClient<typeof rootController>;
