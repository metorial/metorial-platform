import { runQueueProcessors } from '@lowerdeck/queue';
import { cleanupProcessor } from './queues/cleanup';
import { deleteRecordQueueProcessor, indexRecordQueueProcessor } from './queues/record';

await runQueueProcessors([
  indexRecordQueueProcessor,
  deleteRecordQueueProcessor,
  cleanupProcessor
]);
