import {
  dispatchPendingSkillSyncsCron,
  dispatchPendingSkillSyncsQueueProcessor
} from './sync/dispatch';
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
import { lifecycleQueues } from './lifecycle';
import { searchQueues } from './search';
import {
  skillDestinationDeletedFileCleanupCron,
  skillDestinationSyncCleanupCron
} from './sync/cleanup';
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
import { syncReconcileQueueProcessor } from './sync/reconcile';
import { syncStartQueueProcessor } from './sync/start';
import {
  skillSyncDriftCheckCron,
  skillSyncDriftCheckManyQueueProcessor,
  skillSyncDriftCheckSingleQueueProcessor,
  skillSyncRepairCron,
  skillSyncRepairManyQueueProcessor,
  skillSyncRepairSingleQueueProcessor
} from './sync/repair';
import {
  skillDestinationDeleteCodeBucketCron,
  skillDestinationDeleteCodeBucketManyQueueProcessor,
  skillDestinationDeleteCodeBucketSingleQueueProcessor,
  skillDestinationMigrateStorageCron,
  skillDestinationMigrateStorageManyQueueProcessor,
  skillDestinationMigrateStorageSingleQueueProcessor
} from './storage';
import { syncSnapshotQueueProcessor } from './sync/snapshot';
import {
  skillSyncBlobGcCron,
  skillSyncBlobGcManyQueueProcessor,
  skillSyncBlobGcSingleQueueProcessor,
  skillSyncManifestGcManyQueueProcessor,
  skillSyncManifestGcSingleQueueProcessor,
  skillSyncObjectSweepCron,
  skillSyncObjectSweepManyQueueProcessor,
  skillSyncObjectSweepSingleQueueProcessor
} from './sync/storageGc';

export * from './lifecycle';

export let skillMarketplaceQueueProcessor = combineQueueProcessors([
  lifecycleQueues,
  searchQueues,
  collectDirtySkillDestinationsCron,
  collectDirtySkillDestinationsManyQueueProcessor,
  collectDirtySkillDestinationsSingleQueueProcessor,
  flushDirtySkillDestinationsCron,
  flushDirtySkillDestinationsManyQueueProcessor,
  flushDirtySkillDestinationsSingleQueueProcessor,
  dispatchPendingSkillSyncsCron,
  dispatchPendingSkillSyncsQueueProcessor,
  syncStartQueueProcessor,
  syncCollectQueueProcessor,
  syncProcessQueueProcessor,
  syncReconcileQueueProcessor,
  syncPropagateStartQueueProcessor,
  syncPropagatePerformQueueProcessor,
  syncPropagateWaitQueueProcessor,
  originChangeFanoutQueueProcessor,
  originChangePollQueueProcessor,
  originChangePollWatchdogCron,
  originChangeRepairCron,
  syncFinishQueueProcessor,
  skillDestinationSyncCleanupCron,
  skillDestinationDeletedFileCleanupCron,
  skillExportQueueProcessor,
  skillSyncRepairCron,
  skillSyncRepairManyQueueProcessor,
  skillSyncRepairSingleQueueProcessor,
  skillSyncDriftCheckCron,
  skillSyncDriftCheckManyQueueProcessor,
  skillSyncDriftCheckSingleQueueProcessor,
  skillDestinationMigrateStorageCron,
  skillDestinationMigrateStorageManyQueueProcessor,
  skillDestinationMigrateStorageSingleQueueProcessor,
  skillDestinationDeleteCodeBucketCron,
  skillDestinationDeleteCodeBucketManyQueueProcessor,
  skillDestinationDeleteCodeBucketSingleQueueProcessor,
  syncSnapshotQueueProcessor,
  skillSyncBlobGcCron,
  skillSyncBlobGcManyQueueProcessor,
  skillSyncBlobGcSingleQueueProcessor,
  skillSyncManifestGcManyQueueProcessor,
  skillSyncManifestGcSingleQueueProcessor,
  skillSyncObjectSweepCron,
  skillSyncObjectSweepManyQueueProcessor,
  skillSyncObjectSweepSingleQueueProcessor
]);
