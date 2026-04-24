import { combineQueueProcessors } from '@lowerdeck/queue';
import { recordSlateErrorQueueProcessor } from './record';

export let errorQueues = combineQueueProcessors([recordSlateErrorQueueProcessor]);
