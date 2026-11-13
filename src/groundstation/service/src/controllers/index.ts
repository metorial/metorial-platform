import { apiMux } from '@lowerdeck/api-mux';
import { createServer, rpcMux, type InferClient } from '@lowerdeck/rpc-server';
import { app } from './_app';
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
import { usageController } from './usage';

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
  usage: usageController,
  coverage: coverageController,
  rebuild: rebuildController,
  knowledge: knowledgeController,
  pricing: pricingController
});

export let GroundstationRPC = createServer({})(rootController);
export let GroundstationApi = apiMux([
  { endpoint: rpcMux({ path: '/metorial-groundstation' }, [GroundstationRPC]) }
]);

export type GroundstationClient = InferClient<typeof rootController>;
