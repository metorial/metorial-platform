import { combineQueueProcessors } from '@metorial/queue';
import { runSyncProcessors } from './queues/syncRuns';
import { sessionSyncProcessors } from './queues/syncSessions';

export * from './run';

export let catalogQueueProcessor = combineQueueProcessors([
  sessionSyncProcessors,
  runSyncProcessors
]);
