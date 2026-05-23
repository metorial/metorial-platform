import { combineQueueProcessors } from '@mtsrc/queue';
import { recordSlateErrorQueueProcessor } from './record';

export let errorQueues = combineQueueProcessors([recordSlateErrorQueueProcessor]);
