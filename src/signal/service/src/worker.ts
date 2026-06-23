import { runQueueProcessors } from '@lowerdeck/queue';
import { cleanupQueues } from './queues/cleanup';
import { sendQueues } from './queues/send';

await runQueueProcessors([sendQueues, cleanupQueues]);
