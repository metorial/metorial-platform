import { combineQueueProcessors } from '@lowerdeck/queue';
import { cleanupCron } from './cron/cleanup';
import { deploymentConfigPairQueues } from './queues/deploymentConfigPair';
import { lifecycleQueues } from './queues/lifecycle';
import { listingQueues } from './queues/listing';
import { searchQueues } from './queues/search';
import { versionQueues } from './queues/version';

export * from './services';

export * from './lib/checkProviderMatch';
export * from './lib/toolFilter';

export let providerInternalQueueProcessor = combineQueueProcessors([
  listingQueues,
  cleanupCron,
  lifecycleQueues,
  deploymentConfigPairQueues,
  versionQueues,
  searchQueues
]);
