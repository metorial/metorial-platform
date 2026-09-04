import { createServer, rpcMux, type InferClient } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { authController } from './auth';
import { slateController } from './slate';
import { slateDeploymentController } from './slateDeployment';
import { slateDiscoveryController } from './slateDiscovery';
import { slateEventController } from './slateEvent';
import { slateVersionController } from './slateVersion';
import { triggerRoutingMatcherEvaluationController } from './triggerRoutingMatcherEvaluation';
import { webhookController } from './webhook';

export let rootController = app.controller({
  auth: authController,
  slate: slateController,
  slateVersion: slateVersionController,
  slateDeployment: slateDeploymentController,
  slateEvent: slateEventController,
  slateDiscovery: slateDiscoveryController,
  webhook: webhookController,
  triggerRoutingMatcherEvaluation: triggerRoutingMatcherEvaluationController
});

export let slatesHubAdminRPC = createServer({})(rootController);
export let slatesHubAdminApi = rpcMux({ path: '/slates-hub-admin' }, [
  slatesHubAdminRPC
]);

export type SlatesHubAdminClient = InferClient<typeof rootController>;
