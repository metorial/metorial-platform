import { runQueueProcessors } from '@lowerdeck/queue';
import { bootstrapRegistry } from './bootstrap';
import {
  backfillArtifactSizeSingleProcessor,
  backfillArtifactSizesCron,
  backfillArtifactSizesManyProcessor
} from './queues/artifactSizes';
import { cleanupProcessor } from './queues/cleanup';
import { expireTokensProcessor } from './queues/expiresTokens';
import {
  mirrorImportUpstreamVersionProcessor,
  mirrorSyncAllProcessor,
  mirrorSyncCron,
  mirrorSyncToolingProcessor,
  mirrorSyncUpstreamProcessor
} from './queues/mirror/sync';
import { cleanupSlatePackBatchesCron, processSlatePackProcessor } from './queues/mirror/packs';
import { buildSlatePackChannelProcessor, slatePackChannelCron } from './queues/packs/channels';
import { backfillChecksumsCron, backfillChecksumsProcessor } from './queues/signing/checksums';
import { backfillSignaturesProcessor, ensureSigningKeyCron } from './queues/signing';

await runQueueProcessors([
  expireTokensProcessor,
  cleanupProcessor,
  ensureSigningKeyCron,
  backfillSignaturesProcessor,
  backfillChecksumsCron,
  backfillChecksumsProcessor,
  backfillArtifactSizesCron,
  backfillArtifactSizesManyProcessor,
  backfillArtifactSizeSingleProcessor,
  mirrorSyncCron,
  mirrorSyncAllProcessor,
  mirrorSyncUpstreamProcessor,
  mirrorImportUpstreamVersionProcessor,
  mirrorSyncToolingProcessor,
  processSlatePackProcessor,
  cleanupSlatePackBatchesCron,
  slatePackChannelCron,
  buildSlatePackChannelProcessor
]);

void bootstrapRegistry();
