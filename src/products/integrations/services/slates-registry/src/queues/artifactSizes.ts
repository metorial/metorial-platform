import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '../db';
import { env } from '../env';
import { storage } from '../storage';

let pageSize = 500;

let pageDelayMs = 1000;

export let backfillArtifactSizesCron = createCron(
  {
    name: 'sreg/artifacts/sizes/cron',
    cron: '*/15 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await backfillArtifactSizesManyQueue.add(
      {},
      { deduplication: { id: 'backfill-artifact-sizes-start' } }
    );
  }
);

export let backfillArtifactSizesManyQueue = createQueue<{ cursor?: string }>({
  name: 'sreg/artifacts/sizes/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

// Older registry versions stored bundles with size 0, which makes pack splitting treat them
// as free and put every version into a single oversized part.
export let backfillArtifactSizesManyProcessor = backfillArtifactSizesManyQueue.process(
  async data => {
    let artifacts = await db.artifact.findMany({
      where: {
        oid: data.cursor ? { gt: BigInt(data.cursor) } : undefined,
        size: 0,
        slateVersions: { some: {} }
      },
      orderBy: { oid: 'asc' },
      take: pageSize,
      select: { oid: true, id: true }
    });
    if (!artifacts.length) return;

    await backfillArtifactSizeSingleQueue.addManyWithOps(
      artifacts.map(artifact => ({
        data: { artifactId: artifact.id },
        opts: { deduplication: { id: `backfill-artifact-size-${artifact.id}` } }
      }))
    );

    if (artifacts.length === pageSize) {
      await backfillArtifactSizesManyQueue.add(
        { cursor: artifacts[artifacts.length - 1]!.oid.toString() },
        { delay: pageDelayMs }
      );
    }
  }
);

export let backfillArtifactSizeSingleQueue = createQueue<{ artifactId: string }>({
  name: 'sreg/artifacts/sizes/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let backfillArtifactSizeSingleProcessor = backfillArtifactSizeSingleQueue.process(
  async data => {
    let artifact = await db.artifact.findUnique({
      where: { id: data.artifactId },
      select: { oid: true, id: true, bucket: true, storageKey: true, size: true }
    });
    if (!artifact || artifact.size !== 0n) return;

    let info = await storage
      .getObjectInfo(artifact.bucket, artifact.storageKey)
      .catch(error => {
        console.warn(
          `[Registry]: Could not read the size of artifact ${artifact.id}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        return null;
      });
    if (!info?.size) return;

    await db.artifact.updateMany({
      where: { oid: artifact.oid, size: 0 },
      data: { size: info.size }
    });
  }
);
