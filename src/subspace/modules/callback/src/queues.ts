import { combineQueueProcessors } from '@lowerdeck/queue';
import { deleteQueues } from './queues/delete';

export let callbackQueueProcessor = combineQueueProcessors([deleteQueues]);
