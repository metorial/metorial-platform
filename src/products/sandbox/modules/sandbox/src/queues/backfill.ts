import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@metorial/queue';
import { sandboxDiskInclude } from '../internal/diskInternal';
import { sandboxImageVersionInternalService } from '../internal/imageVersionInternal';
import { hydrateByTenant } from '../lib/regional';
import { isSandboxingEnabled } from '../lib/regions';

let BACKFILL_BATCH_SIZE = 500;

export let diskBackfillManyQueue = createQueue<{ cursor?: string }>({
  name: 'sbx/disk/backfill/many',
  workerOpts: { concurrency: 1 }
});

export let diskBackfillManyProcessor = diskBackfillManyQueue.process(async data => {
  let disks = await db.sandboxDisk.findMany({
    where: {
      status: 'active',
      sizeBytes: null,
      ...(data.cursor ? { oid: { gt: BigInt(data.cursor) } } : {})
    },
    orderBy: { oid: 'asc' },
    take: BACKFILL_BATCH_SIZE,
    select: { oid: true }
  });
  if (!disks.length) return;

  await diskBackfillSingleQueue.addMany(disks.map(disk => ({ diskOid: disk.oid.toString() })));

  if (disks.length == BACKFILL_BATCH_SIZE) {
    await diskBackfillManyQueue.add(
      { cursor: disks[disks.length - 1]!.oid.toString() },
      hourlyPacedDelay()
    );
  }
});

export let diskBackfillSingleQueue = createQueue<{ diskOid: string }>({
  name: 'sbx/disk/backfill/single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let diskBackfillSingleProcessor = diskBackfillSingleQueue.process(async data => {
  let disk = await db.sandboxDisk.findFirst({
    where: { oid: BigInt(data.diskOid), sizeBytes: null },
    include: sandboxDiskInclude
  });
  if (!disk) return;

  let [hydrated] = await hydrateByTenant([disk], ({ genesis, tenantId, ids }) =>
    genesis.disk.getMany({ tenantId, ids })
  );
  let remote = hydrated?.remote;
  if (!remote) return;

  await db.sandboxDisk.update({
    where: { oid: disk.oid },
    data: {
      sizeBytes: BigInt(remote.sizeBytes),
      ...(disk.name === null ? { name: remote.name } : {})
    }
  });
});

export let imageVersionNumberBackfillManyQueue = createQueue<{ cursor?: string }>({
  name: 'sbx/image/version-number/backfill/many',
  workerOpts: { concurrency: 1 }
});

export let imageVersionNumberBackfillManyProcessor =
  imageVersionNumberBackfillManyQueue.process(async data => {
    let images = await db.sandboxMachineImage.findMany({
      where: {
        versions: { some: { versionNumber: null } },
        ...(data.cursor ? { oid: { gt: BigInt(data.cursor) } } : {})
      },
      orderBy: { oid: 'asc' },
      take: BACKFILL_BATCH_SIZE,
      select: { oid: true }
    });
    if (!images.length) return;

    await imageVersionNumberBackfillSingleQueue.addMany(
      images.map(image => ({ imageOid: image.oid.toString() }))
    );

    if (images.length == BACKFILL_BATCH_SIZE) {
      await imageVersionNumberBackfillManyQueue.add(
        { cursor: images[images.length - 1]!.oid.toString() },
        hourlyPacedDelay()
      );
    }
  });

export let imageVersionNumberBackfillSingleQueue = createQueue<{ imageOid: string }>({
  name: 'sbx/image/version-number/backfill/single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let imageVersionNumberBackfillSingleProcessor =
  imageVersionNumberBackfillSingleQueue.process(async data => {
    await sandboxImageVersionInternalService.assignNumbers({
      imageOid: BigInt(data.imageOid)
    });
  });

export let startSandboxBackfill = async () => {
  await imageVersionNumberBackfillManyQueue.add({}, { id: 'startup-version-number' });

  if (isSandboxingEnabled()) {
    await diskBackfillManyQueue.add({}, { id: 'startup-disk' });
  }
};

export let backfillProcessors = combineQueueProcessors([
  diskBackfillManyProcessor,
  diskBackfillSingleProcessor,
  imageVersionNumberBackfillManyProcessor,
  imageVersionNumberBackfillSingleProcessor
]);
