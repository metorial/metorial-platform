import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { sandboxImageInternalService } from '../internal/imageInternal';
import { isSandboxingEnabled } from '../lib/regions';
import { sandboxRegionService } from '../services/region';

export let syncImagesCron = createCron(
  {
    name: 'sbx/image/sync/cron',
    cron: '* * * * *'
  },
  async () => {
    if (!isSandboxingEnabled()) return;

    await sandboxRegionService.syncFromEnv();

    let regions = await db.sandboxRegion.findMany({
      where: { status: 'active' },
      select: { oid: true }
    });

    await syncImagesRegionQueue.addManyWithOps(
      regions.map(region => ({
        data: { regionOid: region.oid.toString() },
        opts: { id: `region-${region.oid}` }
      }))
    );
  }
);

export let syncImagesRegionQueue = createQueue<{ regionOid: string }>({
  name: 'sbx/image/sync/region',
  workerOpts: { concurrency: 1 }
});

export let syncImagesRegionQueueProcessor = syncImagesRegionQueue.process(async data => {
  let region = await db.sandboxRegion.findFirst({
    where: { oid: BigInt(data.regionOid), status: 'active' }
  });
  if (!region) return;

  await sandboxImageInternalService.syncRegion({ region });
});

export let syncImagesProcessors = combineQueueProcessors([
  syncImagesCron,
  syncImagesRegionQueueProcessor
]);
