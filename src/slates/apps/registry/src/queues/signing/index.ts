import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { isSigningEnabled } from '../../mode';
import { signingKeyService } from '../../services/signingKey';

let pageSize = 500;

let pageDelayMs = 1000;

export let ensureSigningKeyCron = createCron(
  {
    name: 'sreg/signing/key/cron',
    cron: '17 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    if (!isSigningEnabled()) return;

    let { created } = await signingKeyService.ensureCurrentSigningKey();
    await backfillSignaturesQueue.add({}, { deduplication: { id: 'backfill-start' } });

    if (created) console.log('[Registry]: Created a new slate signing key');
  }
);

export let backfillSignaturesQueue = createQueue<{ cursor?: string }>({
  name: 'sreg/signing/backfill',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

// Every active key signs every version, so a new key re-signs the whole catalog here.
export let backfillSignaturesProcessor = backfillSignaturesQueue.process(async data => {
  if (!isSigningEnabled()) return;

  let keys = await signingKeyService.listActiveSigningKeys();
  if (!keys.length) return;

  let versions = await db.slateVersion.findMany({
    where: {
      oid: data.cursor ? { gt: BigInt(data.cursor) } : undefined,
      bundleArtifact: { checksum: { not: '' } },
      OR: keys.map(key => ({ signatures: { none: { kid: key.kid } } }))
    },
    orderBy: { oid: 'asc' },
    take: pageSize,
    select: {
      oid: true,
      version: true,
      slate: { select: { fullIdentifier: true } },
      bundleArtifact: { select: { checksum: true } }
    }
  });
  if (!versions.length) return;

  await signingKeyService.signSlateVersions({ versions });

  if (versions.length === pageSize) {
    await backfillSignaturesQueue.add(
      { cursor: versions[versions.length - 1]!.oid.toString() },
      { delay: pageDelayMs }
    );
  }
});
