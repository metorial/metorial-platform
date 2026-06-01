import { combineQueueProcessors } from '@lowerdeck/queue';
import { reconcileQueues } from './queues/reconcile';

export let monitorQueueProcessor = combineQueueProcessors([reconcileQueues]);
