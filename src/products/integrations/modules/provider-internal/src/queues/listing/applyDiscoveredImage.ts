import { createQueue } from '@lowerdeck/queue';
import { webDiscoveryService } from '@metorial/module-web';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { listingUpdatedQueue } from '../lifecycle/listing';

let MAX_POLL_ATTEMPTS = 12;
let POLL_BASE_DELAY_MS = 5_000;
let POLL_MAX_DELAY_MS = 60_000;

type ApplyDiscoveredImagePayload = {
  providerListingId: string;
  discoveryId: string;
  attempt: number;
};

export let applyDiscoveredImageQueue = createQueue<ApplyDiscoveredImagePayload>({
  name: 'sub/pint/listing/applyimg',
  workerOpts: { concurrency: 5 },
  redisUrl: env.service.REDIS_URL
});

export let enqueueApplyDiscoveredImage = async (
  data: Omit<ApplyDiscoveredImagePayload, 'attempt'> & { attempt?: number },
  delayMs?: number
) => {
  let attempt = data.attempt ?? 0;

  await applyDiscoveredImageQueue.add(
    { providerListingId: data.providerListingId, discoveryId: data.discoveryId, attempt },
    {
      id: `${data.providerListingId}_${data.discoveryId}_${attempt}`,
      ...(delayMs ? { delay: delayMs } : {})
    }
  );
};

let getUrlImage = (image: unknown) => {
  if (!image || typeof image !== 'object') return null;

  let { type, url } = image as { type?: unknown; url?: unknown };
  if (type !== 'url' || typeof url !== 'string') return null;

  return url;
};

export let applyDiscoveredImageQueueProcessor = applyDiscoveredImageQueue.process(
  async data => {
    let discovery = await webDiscoveryService.getWebDiscoveryById({
      webDiscoveryId: data.discoveryId
    });

    if (discovery.status === 'failed') return;

    if (discovery.status !== 'succeeded') {
      let nextAttempt = data.attempt + 1;
      if (nextAttempt >= MAX_POLL_ATTEMPTS) return;

      await enqueueApplyDiscoveredImage(
        { ...data, attempt: nextAttempt },
        Math.min(POLL_BASE_DELAY_MS * 2 ** data.attempt, POLL_MAX_DELAY_MS)
      );
      return;
    }

    let url = getUrlImage(discovery.image);
    if (!url) return;

    let listing = await db.providerListing.findFirst({
      where: { id: data.providerListingId }
    });
    if (!listing || listing.isCustomized) return;
    if (getUrlImage(listing.image) === url) return;

    await db.providerListing.updateMany({
      where: { oid: listing.oid, isCustomized: false },
      data: { image: { type: 'url', url } }
    });

    await listingUpdatedQueue.add({ providerListingId: listing.id });
  }
);
