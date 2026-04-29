import { combineQueueProcessors } from '@lowerdeck/queue';
import { indexIntegrationQueueProcessor } from './integration';

export let searchQueues = combineQueueProcessors([indexIntegrationQueueProcessor]);
