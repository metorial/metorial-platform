import { combineQueueProcessors } from '@metorial/queue';
import { reconcileConsumerClientProcessors } from './reconcileConsumerClient';

export * from './reconcileConsumerClient';

export let portalQueues = combineQueueProcessors([reconcileConsumerClientProcessors]);
