import { combineQueueProcessors } from '@lowerdeck/queue';
import { syncCollectQueueProcessor } from './sync/collect';
import { syncFinishQueueProcessor } from './sync/finish';
import { syncProcessQueueProcessor } from './sync/process';
import { syncPropagateQueueProcessor } from './sync/propagate';
import { syncStartQueueProcessor } from './sync/start';

export let skillQueueProcessor = combineQueueProcessors([
  syncStartQueueProcessor,
  syncCollectQueueProcessor,
  syncProcessQueueProcessor,
  syncPropagateQueueProcessor,
  syncFinishQueueProcessor
]);
