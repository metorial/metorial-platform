import { runQueueProcessors } from '@lowerdeck/queue';
import { groundstationQueues } from './queues';
import { startKnowledgeSyncOnce } from './queues/knowledgeSync';
import { startVersionRebuildsOnce } from './rebuild';

await runQueueProcessors([groundstationQueues]);

await startVersionRebuildsOnce();

await startKnowledgeSyncOnce();
