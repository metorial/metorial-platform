import { combineQueueProcessors } from '@mtsrc/queue';
import { reconcileQueueProcessor } from './reconcile';

export let reconcileQueues = combineQueueProcessors([reconcileQueueProcessor]);
