import { combineQueueProcessors } from '@metorial/queue';
import { runSyncProcessors } from './queues/syncRuns';
import { sessionSyncProcessors } from './queues/syncSessions';

export * from './run';
export * from './services';

export let engineQueueProcessor = combineQueueProcessors([
  sessionSyncProcessors,
  runSyncProcessors
]);
