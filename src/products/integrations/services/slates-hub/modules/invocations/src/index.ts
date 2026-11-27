import { combineQueueProcessors } from '@lowerdeck/queue';
import { attachmentQueues } from './queues/attachment';

export let invocationQueueProcessor = combineQueueProcessors([attachmentQueues]);
