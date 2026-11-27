import { combineQueueProcessors } from '@lowerdeck/queue';
import { commitQueues } from './queues/commit';
import { deploymentQueues } from './queues/deployment';
import { lifecycleFederationQueues, lifecycleSubspaceQueues } from './queues/lifecycle';
import { scmQueues } from './queues/scm';
import { searchQueues } from './queues/search';
import { upcomingQueues } from './queues/upcoming';

export let customProviderSubspaceQueueProcessor = combineQueueProcessors([
  lifecycleSubspaceQueues,
  scmQueues,
  deploymentQueues,
  commitQueues,
  upcomingQueues
]);

export let customProviderFederationQueueProcessor = combineQueueProcessors([
  lifecycleFederationQueues,
  searchQueues
]);

export let customProviderQueueProcessor = combineQueueProcessors([
  customProviderSubspaceQueueProcessor,
  customProviderFederationQueueProcessor
]);
