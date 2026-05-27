import { runQueueProcessors } from '@lowerdeck/queue';
import { buildProcessors } from './queues/build';
import { cleanupProcessor } from './queues/cleanup';
import { enclaveOverrideCloneQueueProcessor } from './queues/enclaveOverride';

await runQueueProcessors([
  buildProcessors,
  cleanupProcessor,
  enclaveOverrideCloneQueueProcessor
]);
