import { runQueueProcessors } from '@lowerdeck/queue';
import { buildProcessors } from './queues/build';
import { cleanupProcessor } from './queues/cleanup';
import { enclaveOverrideCloneQueueProcessor } from './queues/enclaveOverride';
import { rehomeProcessors, startRehome } from './queues/rehome';

await runQueueProcessors([
  buildProcessors,
  cleanupProcessor,
  enclaveOverrideCloneQueueProcessor,
  rehomeProcessors
]);

await startRehome();
