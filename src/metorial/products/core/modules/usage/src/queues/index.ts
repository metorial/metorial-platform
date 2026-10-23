import { combineQueueProcessors } from '@metorial/queue';
import { usageBackfillProcessors } from './backfill';
import { usageFlushProcessors } from './flush';
import { usageRecordSessionProcessor } from './recordSession';

export let usageQueueProcessors = combineQueueProcessors([
  usageFlushProcessors,
  usageBackfillProcessors,
  usageRecordSessionProcessor
]);
