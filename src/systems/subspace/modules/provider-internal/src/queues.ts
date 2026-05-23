import { combineQueueProcessors } from '@mtsrc/queue';
import { cleanupCron } from './cron/cleanup';
import { deploymentConfigPairQueues } from './queues/deploymentConfigPair';
import { lifecycleQueues } from './queues/lifecycle';
import { listingQueues } from './queues/listing';
import { reconcilerQueues } from './queues/reconciler';
import { searchQueues } from './queues/search';
import { versionQueues } from './queues/version';

export let providerInternalQueueProcessor = combineQueueProcessors([
  listingQueues,
  cleanupCron,
  lifecycleQueues,
  deploymentConfigPairQueues,
  versionQueues,
  searchQueues,
  reconcilerQueues
]);
