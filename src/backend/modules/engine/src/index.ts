import { combineQueueProcessors } from '@metorial/queue';
import { runSyncProcessors } from './queues/syncRuns';
import { sessionSyncProcessors } from './queues/syncSessions';

export * from './run/connection';

export let catalogQueueProcessor = combineQueueProcessors([
  sessionSyncProcessors,
  runSyncProcessors
]);
