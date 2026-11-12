import { runQueueProcessors } from '@lowerdeck/queue';
import { groundstationQueues } from './queues';

await runQueueProcessors([groundstationQueues]);
