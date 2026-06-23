import { combineQueueProcessors } from '@lowerdeck/queue';
import { reconcileQueueProcessor } from './reconcile';

export let reconcileQueues = combineQueueProcessors([reconcileQueueProcessor]);
