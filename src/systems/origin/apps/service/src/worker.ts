import { runQueueProcessors } from '@mtsrc/queue';
import { cleanupProcessor } from './queues/cleanup';
import { codeBucketQueueProcessor } from './queues/codeBucket';
import { scmQueueProcessor } from './queues/scm';

await runQueueProcessors([cleanupProcessor, scmQueueProcessor, codeBucketQueueProcessor]);
