import { combineQueueProcessors } from '@lowerdeck/queue';
import { callbackQueues } from './queues/callback';

export let callbackQueueProcessor = combineQueueProcessors([callbackQueues]);
