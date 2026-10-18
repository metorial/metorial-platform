import { createLock } from '@lowerdeck/lock';
import { env } from '../env';

let sessionTemplateSyncLock = createLock({
  name: 'sub-ses-st-sync-lock',
  redisUrl: env.service.REDIS_URL
});

// Every holder runs a full, idempotent re-sync of the template inside a transaction, and bursts
// (e.g. backing backfills) queue several of them on one template, so waiting beats failing.
let SESSION_TEMPLATE_SYNC_LOCK_ACQUISITION_TIMEOUT_MS = 20_000;

export let queueJobId = (...parts: (string | undefined | null)[]) =>
  parts
    .filter((part): part is string => !!part)
    .join('-')
    .replace(/:/g, '-');

export let withSessionTemplateSyncLock = async <T>(
  sessionTemplateId: string,
  cb: () => Promise<T>
) => {
  return await sessionTemplateSyncLock.usingLock(queueJobId('st', sessionTemplateId), cb, {
    acquisitionTimeoutMs: SESSION_TEMPLATE_SYNC_LOCK_ACQUISITION_TIMEOUT_MS,
    retryCount: 100
  });
};
