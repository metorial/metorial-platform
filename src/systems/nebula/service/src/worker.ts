import { runQueueProcessors } from '@lowerdeck/queue';
import { cleanupSecretUseProcessors } from './queues/cleanupSecretUse';

await runQueueProcessors([cleanupSecretUseProcessors]);
