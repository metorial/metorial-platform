import { apiMux } from '@lowerdeck/api-mux';
import { createServer, rpcMux, type InferClient } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { providerController } from './provider';
import { tenantController } from './tenant';
import { workflowController } from './workflow';
import { workflowArtifactController } from './workflowArtifact';
import { workflowRunController } from './workflowRun';
import { workflowVersionController } from './workflowVersion';

export let rootController = app.controller({
  tenant: tenantController,
  provider: providerController,
  workflow: workflowController,
  workflowArtifact: workflowArtifactController,
  workflowRun: workflowRunController,
  workflowVersion: workflowVersionController
});

export let forgeRPC = createServer({})(rootController);
export let forgeApi = apiMux([{ endpoint: rpcMux({ path: '/metorial-forge' }, [forgeRPC]) }]);

export type ForgeClient = InferClient<typeof rootController>;
