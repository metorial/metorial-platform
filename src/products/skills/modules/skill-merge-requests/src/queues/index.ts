import { combineQueueProcessors } from '@metorial/queue';
import { skillForkSyncQueueProcessor } from './forkSync';
import {
  skillMergeRequestPerformQueueProcessor,
  skillMergeRequestRecoveryCron
} from './mergeRequest';

export * from './forkSync';
export * from './mergeRequest';

export let skillMergeRequestQueueProcessor = combineQueueProcessors([
  skillMergeRequestPerformQueueProcessor,
  skillMergeRequestRecoveryCron,
  skillForkSyncQueueProcessor
]);
