import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { ignoreNotFound } from '../lib/ignoreNotFound';
import { getRegionClient } from '../lib/regions';

export let imageBuildCancelRootQueue = createQueue<{ buildOid: string }>({
  name: 'sbx/image/build/cancel/root',
  workerOpts: { concurrency: 10 }
});

export let imageBuildCancelRootQueueProcessor = imageBuildCancelRootQueue.process(
  async data => {
    let rows = await db.sandboxMachineImageBuildRegion.findMany({
      where: {
        buildOid: BigInt(data.buildOid),
        status: 'cancelled',
        genesisBuildId: { not: null }
      },
      select: { oid: true }
    });

    await imageBuildCancelRegionQueue.addManyWithOps(
      rows.map(row => ({ data: { buildRegionOid: row.oid.toString() } }))
    );
  }
);

export let imageBuildCancelRegionQueue = createQueue<{ buildRegionOid: string }>({
  name: 'sbx/image/build/cancel/region',
  workerOpts: { concurrency: 10 }
});

export let imageBuildCancelRegionQueueProcessor = imageBuildCancelRegionQueue.process(
  async data => {
    let row = await db.sandboxMachineImageBuildRegion.findFirst({
      where: {
        oid: BigInt(data.buildRegionOid),
        status: 'cancelled',
        genesisBuildId: { not: null }
      },
      include: { region: true, tenant: true }
    });
    if (!row) return;

    await ignoreNotFound(
      getRegionClient(row.region.id).machineImage.build.cancel({
        tenantId: row.tenant.id,
        buildId: row.genesisBuildId!
      })
    );
  }
);

export let imageBuildCancelProcessors = combineQueueProcessors([
  imageBuildCancelRootQueueProcessor,
  imageBuildCancelRegionQueueProcessor
]);
