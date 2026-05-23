import { combineQueueProcessors } from '@mtsrc/queue';
import { indexCustomProviderQueueProcessor } from './customProvider';

export let searchQueues = combineQueueProcessors([indexCustomProviderQueueProcessor]);
