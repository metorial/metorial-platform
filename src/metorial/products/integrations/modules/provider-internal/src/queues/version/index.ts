import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  syncVersionCron,
  syncVersionManyCronProcessor,
  syncVersionSingleCronProcessor
} from './cron';
import { providerVersionSetSpecificationQueueProcessor } from './setSpec';
import { providerVersionSyncSpecificationQueueProcessor } from './syncSpec';

export let versionQueues = combineQueueProcessors([
  providerVersionSyncSpecificationQueueProcessor,
  providerVersionSetSpecificationQueueProcessor,

  syncVersionCron,
  syncVersionManyCronProcessor,
  syncVersionSingleCronProcessor
]);
