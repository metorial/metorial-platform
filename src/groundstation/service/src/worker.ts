import { runQueueProcessors } from '@lowerdeck/queue';
import { groundstationQueues } from './queues';
import { startVersionRebuildsOnce } from './rebuild';

await runQueueProcessors([groundstationQueues]);

await startVersionRebuildsOnce();
