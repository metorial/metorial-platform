import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue, type IQueueProcessor } from '@metorial/queue';
import { sandboxRegionInternalService } from '../internal/regionInternal';
import { sandboxSpecInternalService } from '../internal/specInternal';
import { isSandboxingEnabled } from '../lib/regions';

let SYNC_CRON = '*/15 * * * *';
let STARTUP_SYNC_INTERVAL_MS = 60 * 60 * 1000;

let enqueueRegionSyncs = async () => {
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
};

export let syncSpecsCron = createCron(
  {
    name: 'sbx/spec/sync/cron',
    cron: SYNC_CRON
  },
  enqueueRegionSyncs
);

export let syncSpecsStartupQueue = createQueue<{}>({
  name: 'sbx/spec/sync/startup',
  workerOpts: { concurrency: 1, limiter: { max: 1, duration: STARTUP_SYNC_INTERVAL_MS } }
});

export let syncSpecsStartupQueueProcessor = syncSpecsStartupQueue.process(enqueueRegionSyncs);

export let syncSpecsStartupTrigger: IQueueProcessor = {
  start: async () => {
    if (!isSandboxingEnabled()) return;

    await syncSpecsStartupQueue.addManyWithOps([{ data: {}, opts: { id: 'startup' } }]);
  }
};

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
  syncSpecsStartupQueueProcessor,
  syncSpecsStartupTrigger,
  syncSpecsRegionQueueProcessor
]);
