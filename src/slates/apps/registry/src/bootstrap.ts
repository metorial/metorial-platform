import { delay } from '@lowerdeck/delay';
import { isMirrorMode, isSigningEnabled } from './mode';
import { mirrorSyncAllQueue } from './queues/mirror/sync';
import { backfillSignaturesQueue } from './queues/signing';
import { mirrorService } from './services/mirror';
import { signingKeyService } from './services/signingKey';

let retryDelayMs = 5000;

let bootstrapSigning = async () => {
  if (!isSigningEnabled()) return;

  await signingKeyService.ensureCurrentSigningKey();
  await backfillSignaturesQueue.add({}, { deduplication: { id: 'backfill-start' } });
};

let bootstrapMirror = async () => {
  if (!isMirrorMode()) return;

  await mirrorService.ensureContext();
  await mirrorService.syncStaticUpstreams();
  await mirrorSyncAllQueue.add({}, { deduplication: { id: 'mirror-sync-all' } });
};

export let bootstrapRegistry = async () => {
  while (true) {
    try {
      await bootstrapSigning();
      await bootstrapMirror();
      return;
    } catch (error) {
      console.error('[Registry]: Bootstrap failed, retrying...', error);
    }

    await delay(retryDelayMs);
  }
};
