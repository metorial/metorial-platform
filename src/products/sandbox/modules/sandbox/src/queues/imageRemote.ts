import { db, type SandboxMachineImage } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { ignoreNotFound } from '../lib/ignoreNotFound';
import { getRegionClient } from '../lib/regions';

let remoteTargets = async (d: { image: SandboxMachineImage; regionOid?: bigint }) => {
  let regionFilter = d.regionOid === undefined ? {} : { regionOid: d.regionOid };
  let isDeleted = d.image.status == 'deleted';

  let [imageRegions, buildRegions] = await Promise.all([
    db.sandboxMachineImageRegion.findMany({
      where: {
        imageOid: d.image.oid,
        tenantOid: { not: null },
        ...(isDeleted ? {} : { status: 'active' }),
        ...regionFilter
      },
      include: { region: true, tenant: true }
    }),
    db.sandboxMachineImageBuildRegion.findMany({
      where: {
        build: { imageOid: d.image.oid },
        genesisImageId: { not: null },
        ...regionFilter
      },
      include: { region: true, tenant: true }
    })
  ]);

  let targets = new Map<
    string,
    { regionOid: bigint; regionId: string; tenantId: string; genesisImageId: string }
  >();

  for (let row of imageRegions) {
    targets.set(`${row.regionOid}:${row.genesisId}`, {
      regionOid: row.regionOid,
      regionId: row.region.id,
      tenantId: row.tenant!.id,
      genesisImageId: row.genesisId
    });
  }

  for (let row of buildRegions) {
    targets.set(`${row.regionOid}:${row.genesisImageId}`, {
      regionOid: row.regionOid,
      regionId: row.region.id,
      tenantId: row.tenant.id,
      genesisImageId: row.genesisImageId!
    });
  }

  return [...targets.values()];
};

export let imageRemoteRootQueue = createQueue<{ imageOid: string }>({
  name: 'sbx/image/remote/root',
  workerOpts: { concurrency: 10 }
});

export let imageRemoteRootQueueProcessor = imageRemoteRootQueue.process(async data => {
  let image = await db.sandboxMachineImage.findFirst({
    where: { oid: BigInt(data.imageOid) }
  });
  if (!image) return;

  let regionOids = new Set((await remoteTargets({ image })).map(target => target.regionOid));

  await imageRemoteRegionQueue.addManyWithOps(
    [...regionOids].map(regionOid => ({
      data: { imageOid: data.imageOid, regionOid: regionOid.toString() }
    }))
  );
});

export let imageRemoteRegionQueue = createQueue<{ imageOid: string; regionOid: string }>({
  name: 'sbx/image/remote/region',
  workerOpts: { concurrency: 10 }
});

export let imageRemoteRegionQueueProcessor = imageRemoteRegionQueue.process(async data => {
  let image = await db.sandboxMachineImage.findFirst({
    where: { oid: BigInt(data.imageOid) }
  });
  if (!image) return;

  let targets = await remoteTargets({ image, regionOid: BigInt(data.regionOid) });

  for (let target of targets) {
    let client = getRegionClient(target.regionId).machineImage;

    await ignoreNotFound(
      image.status == 'deleted'
        ? client.delete({ tenantId: target.tenantId, imageId: target.genesisImageId })
        : client.update({
            tenantId: target.tenantId,
            imageId: target.genesisImageId,
            name: image.name
          })
    );
  }
});

export let imageRemoteProcessors = combineQueueProcessors([
  imageRemoteRootQueueProcessor,
  imageRemoteRegionQueueProcessor
]);
