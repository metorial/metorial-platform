import { combineQueueProcessors } from '@lowerdeck/queue';
import { indexCallbackQueueProcessor } from './callback';

export let searchQueues = combineQueueProcessors([indexCallbackQueueProcessor]);
