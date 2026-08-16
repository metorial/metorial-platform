import { combineQueueProcessors } from '@metorial/queue';
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
import { skillImportAcquireQueueProcessor } from './import/acquire';
import { skillImportDiscoverQueueProcessor } from './import/discover';
import { skillImportFinishQueueProcessor } from './import/finish';
import { skillImportItemQueueProcessor } from './import/item';
import { skillImportRecoveryCron } from './import/recovery';
import { lifecycleQueues } from './lifecycle';
import {
  reconcileSkillProviderLinksForIntegrationProviderQueueProcessor,
  reconcileSkillProviderLinksForProviderQueueProcessor,
  reconcileSkillProviderLinksQueueProcessor
} from './reconcileSkillProviderLinks';
import { searchQueues } from './search';
import { skillDestinationSyncCleanupCron } from './sync/cleanup';
import { syncCollectQueueProcessor } from './sync/collect';
import { syncFinishQueueProcessor } from './sync/finish';
import {
  originChangeFanoutQueueProcessor,
  originChangePollQueueProcessor,
  originChangePollWatchdogCron,
  originChangeRepairCron
} from './sync/originChanges';
import { syncProcessQueueProcessor } from './sync/process';
import {
  syncPropagatePerformQueueProcessor,
  syncPropagateStartQueueProcessor,
  syncPropagateWaitQueueProcessor
} from './sync/propagate';
import { syncStartQueueProcessor } from './sync/start';

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
  originChangeFanoutQueueProcessor,
  originChangePollQueueProcessor,
  originChangePollWatchdogCron,
  originChangeRepairCron,
  syncFinishQueueProcessor,
  skillDestinationSyncCleanupCron,
  skillExportQueueProcessor,
  skillImportAcquireQueueProcessor,
  skillImportDiscoverQueueProcessor,
  skillImportItemQueueProcessor,
  skillImportFinishQueueProcessor,
  skillImportRecoveryCron,
  reconcileSkillProviderLinksQueueProcessor,
  reconcileSkillProviderLinksForIntegrationProviderQueueProcessor,
  reconcileSkillProviderLinksForProviderQueueProcessor
]);

export * from './export';
export * from './import/acquire';
export * from './lifecycle';
export * from './reconcileSkillProviderLinks';
export * from './search';
