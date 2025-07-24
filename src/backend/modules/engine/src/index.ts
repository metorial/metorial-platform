import { combineQueueProcessors } from '@metorial/queue';
import { discoverServerDeploymentQueueProcessor } from './queues/discoverServer';
import { runSyncProcessors } from './queues/syncRuns';
import { sessionSyncProcessors } from './queues/syncSessions';

export * from './run';
export * from './services';

export let engineQueueProcessor = combineQueueProcessors([
  discoverServerDeploymentQueueProcessor,
  sessionSyncProcessors,
  runSyncProcessors
]);
