import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { sandboxRegionInternalService } from '../internal/regionInternal';
import { sandboxSpecInternalService } from '../internal/specInternal';
import { isSandboxingEnabled } from '../lib/regions';

export let syncSpecsCron = createCron(
  {
    name: 'sbx/spec/sync/cron',
    cron: '* * * * *'
  },
  async () => {
    if (!isSandboxingEnabled()) return;

    await sandboxRegionInternalService.syncFromEnv();

    let regions = await db.sandboxRegion.findMany({
      where: { status: 'active' },
      select: { oid: true }
    });

    await syncSpecsRegionQueue.addManyWithOps(
      regions.map(region => ({
        data: { regionOid: region.oid.toString() },
        opts: { id: `region-${region.oid}` }
      }))
    );
  }
);

export let syncSpecsRegionQueue = createQueue<{ regionOid: string }>({
  name: 'sbx/spec/sync/region',
  workerOpts: { concurrency: 1 }
});

export let syncSpecsRegionQueueProcessor = syncSpecsRegionQueue.process(async data => {
  let region = await db.sandboxRegion.findFirst({
    where: { oid: BigInt(data.regionOid), status: 'active' }
  });
  if (!region) return;

  await sandboxSpecInternalService.syncRegion({ region });
});

export let syncSpecsProcessors = combineQueueProcessors([
  syncSpecsCron,
  syncSpecsRegionQueueProcessor
]);
