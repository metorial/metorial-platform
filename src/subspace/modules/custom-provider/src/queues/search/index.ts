import { combineQueueProcessors } from '@lowerdeck/queue';
import { indexCustomProviderQueueProcessor } from './customProvider';

export let searchQueues = combineQueueProcessors([indexCustomProviderQueueProcessor]);
