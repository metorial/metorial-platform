import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  collectDirtySkillDestinationsCron,
  collectDirtySkillDestinationsManyQueueProcessor,
  collectDirtySkillDestinationsSingleQueueProcessor
} from './dirty/collect';
import {
  flushDirtySkillDestinationsCron,
  flushDirtySkillDestinationsManyQueueProcessor,
  flushDirtySkillDestinationsSingleQueueProcessor
} from './dirty/flush';
import { skillExportQueueProcessor } from './export';
import { lifecycleQueues } from './lifecycle';
import { searchQueues } from './search';
import { skillDestinationSyncCleanupCron } from './sync/cleanup';
import { syncCollectQueueProcessor } from './sync/collect';
import { syncFinishQueueProcessor } from './sync/finish';
import { syncProcessQueueProcessor } from './sync/process';
import {
  syncPropagatePerformQueueProcessor,
  syncPropagateStartQueueProcessor,
  syncPropagateWaitQueueProcessor
} from './sync/propagate';
import { syncStartQueueProcessor } from './sync/start';
import {
  skillMergeRequestPerformQueueProcessor,
  skillMergeRequestRecoveryCron
} from './mergeRequest';
import { skillForkSyncQueueProcessor } from './forkSync';
import { skillImportAcquireQueueProcessor } from './import/acquire';
import { skillImportDiscoverQueueProcessor } from './import/discover';
import { skillImportFinishQueueProcessor } from './import/finish';
import { skillImportItemQueueProcessor } from './import/item';
import { skillImportRecoveryCron } from './import/recovery';

export let skillQueueProcessor = combineQueueProcessors([
  lifecycleQueues,
  searchQueues,
  collectDirtySkillDestinationsCron,
  collectDirtySkillDestinationsManyQueueProcessor,
  collectDirtySkillDestinationsSingleQueueProcessor,
  flushDirtySkillDestinationsCron,
  flushDirtySkillDestinationsManyQueueProcessor,
  flushDirtySkillDestinationsSingleQueueProcessor,
  syncStartQueueProcessor,
  syncCollectQueueProcessor,
  syncProcessQueueProcessor,
  syncPropagateStartQueueProcessor,
  syncPropagatePerformQueueProcessor,
  syncPropagateWaitQueueProcessor,
  syncFinishQueueProcessor,
  skillDestinationSyncCleanupCron,
  skillExportQueueProcessor,
  skillMergeRequestPerformQueueProcessor,
  skillMergeRequestRecoveryCron,
  skillForkSyncQueueProcessor,
  skillImportAcquireQueueProcessor,
  skillImportDiscoverQueueProcessor,
  skillImportItemQueueProcessor,
  skillImportFinishQueueProcessor,
  skillImportRecoveryCron
]);

export * from './lifecycle';
export * from './search';
export * from './export';
export * from './mergeRequest';
export * from './forkSync';
export * from './import/acquire';
