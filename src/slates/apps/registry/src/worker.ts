import { runQueueProcessors } from '@lowerdeck/queue';
import { cleanupProcessor } from './queues/cleanup';
import { expireTokensProcessor } from './queues/expiresTokens';

await runQueueProcessors([expireTokensProcessor, cleanupProcessor]);
