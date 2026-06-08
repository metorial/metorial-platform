import { combineQueueProcessors } from '@lowerdeck/queue';
import { indexIntegrationQueueProcessor } from './integration';
import { indexIntegrationInstanceQueueProcessor } from './integrationInstance';

export let searchQueues = combineQueueProcessors([
  indexIntegrationQueueProcessor,
  indexIntegrationInstanceQueueProcessor
]);
