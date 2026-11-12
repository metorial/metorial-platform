import { runQueueProcessors } from '@lowerdeck/queue';
import { bootstrapRegistry } from './bootstrap';
import { cleanupProcessor } from './queues/cleanup';
import { expireTokensProcessor } from './queues/expiresTokens';
import {
  mirrorImportUpstreamVersionProcessor,
  mirrorSyncAllProcessor,
  mirrorSyncCron,
  mirrorSyncUpstreamProcessor
} from './queues/mirror/sync';
import { processSlatePackProcessor } from './queues/mirror/packs';
import { backfillSignaturesProcessor, ensureSigningKeyCron } from './queues/signing';

await runQueueProcessors([
  expireTokensProcessor,
  cleanupProcessor,
  ensureSigningKeyCron,
  backfillSignaturesProcessor,
  mirrorSyncCron,
  mirrorSyncAllProcessor,
  mirrorSyncUpstreamProcessor,
  mirrorImportUpstreamVersionProcessor,
  processSlatePackProcessor
]);

void bootstrapRegistry();
