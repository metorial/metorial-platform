import { combineQueueProcessors } from '@metorial/queue';
import { checkEdition } from '@metorial/editions';
import { usageFlushProcessors } from './flush';
import { usageRecordSessionProcessor } from './recordSession';

let cloud = checkEdition('cloud') ? await import('./backfill') : undefined;

let onPrem = checkEdition('on-prem') ? await import('./retention') : undefined;

export let usageQueueProcessors = combineQueueProcessors([
  usageFlushProcessors,
  ...(cloud ? [cloud.usageBackfillProcessors] : []),
  ...(onPrem ? [onPrem.usageRetentionProcessors] : []),
  usageRecordSessionProcessor
]);
