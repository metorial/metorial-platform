import { combineQueueProcessors } from '@lowerdeck/queue';
import { identityActorArchivedCleanupCron } from './actor';
import { agentArchivedCleanupCron } from './agent';
import { identityArchivedCleanupCron } from './identity';

export let deleteQueues = combineQueueProcessors([
  identityActorArchivedCleanupCron,
  agentArchivedCleanupCron,
  identityArchivedCleanupCron
]);
