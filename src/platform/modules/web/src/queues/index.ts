import { combineQueueProcessors } from '@metorial/queue';
import { runDiscoveryProcessor } from './discovery';
import { recoverDiscoveriesProcessors } from './recovery';

export * from './discovery';

export let webDiscoveryQueueProcessor = combineQueueProcessors([
  runDiscoveryProcessor,
  recoverDiscoveriesProcessors
]);
