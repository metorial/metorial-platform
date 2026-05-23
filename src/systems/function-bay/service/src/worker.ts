import { runQueueProcessors } from '@mtsrc/queue';
import { buildProcessors } from './queues/build';
import { cleanupProcessor } from './queues/cleanup';

await runQueueProcessors([buildProcessors, cleanupProcessor]);
