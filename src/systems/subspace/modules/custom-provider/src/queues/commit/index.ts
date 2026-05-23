import { combineQueueProcessors } from '@mtsrc/queue';
import { commitApplyQueueProcessor } from './apply';

export let commitQueues = combineQueueProcessors([commitApplyQueueProcessor]);
