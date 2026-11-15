import { apiMux } from '@lowerdeck/api-mux';
import { createServer, rpcMux, type InferClient } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { billingController } from './billing';
import { entityController } from './entity';
import { kindController } from './kind';
import { linkController } from './link';
import { membershipsController } from './memberships';
import { userController } from './user';
import { ingestSourceController } from './ingestSource';
import { ingestTokenController } from './ingestToken';
import { instanceController } from './instance';
import { knowledgeController } from './knowledge';
import { organizationController } from './organization';
import { pricingController } from './pricing';
import { projectController } from './project';
import { recordsController } from './records';
import { coverageController } from './coverage';
import { rebuildController } from './rebuild';
import { ruleController } from './rule';
import { sessionController } from './session';
import { queryController } from './query';
import { queryExportController } from './queryExport';

export let rootController = app.controller({
  organization: organizationController,
  project: projectController,
  instance: instanceController,
  ingestToken: ingestTokenController,
  ingestSource: ingestSourceController,
  records: recordsController,
  kind: kindController,
  entity: entityController,
  link: linkController,
  memberships: membershipsController,
  user: userController,
  rule: ruleController,
  session: sessionController,
  query: queryController,
  queryExport: queryExportController,
  coverage: coverageController,
  rebuild: rebuildController,
  knowledge: knowledgeController,
  pricing: pricingController,
  billing: billingController
});

export let AgentTrackingRPC = createServer({})(rootController);
export let AgentTrackingApi = apiMux([
  { endpoint: rpcMux({ path: '/metorial-agent-tracking' }, [AgentTrackingRPC]) }
]);

export type AgentTrackingClient = InferClient<typeof rootController>;
