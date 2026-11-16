import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { isSigningEnabled } from '../../mode';
import { artifactChecksumService } from '../../services/artifactChecksum';
import { backfillSignaturesQueue } from './index';

let pageSize = 25;

let pageDelayMs = 1000;

export let backfillChecksumsCron = createCron(
  {
    name: 'sreg/signing/checksums/cron',
    cron: '47 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    if (!isSigningEnabled()) return;

    await backfillChecksumsQueue.add({}, { deduplication: { id: 'backfill-checksums-start' } });
  }
);

export let backfillChecksumsQueue = createQueue<{ cursor?: string }>({
  name: 'sreg/signing/checksums',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

// Artifacts from before content checksums are skipped by signing and slate packs until
// this fills them in; signing is kicked off once the whole catalog has been walked.
export let backfillChecksumsProcessor = backfillChecksumsQueue.process(async data => {
  if (!isSigningEnabled()) return;

  let page = await artifactChecksumService.backfillPage({ cursor: data.cursor, pageSize });

  if (page.nextCursor) {
    await backfillChecksumsQueue.add({ cursor: page.nextCursor }, { delay: pageDelayMs });
    return;
  }

  await backfillSignaturesQueue.add({}, { deduplication: { id: 'backfill-start' } });
});
