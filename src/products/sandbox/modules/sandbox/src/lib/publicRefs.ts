import { createLocallyCachedFunction } from '@metorial/cache';
import { db } from '@metorial/db';

let REF_CACHE_TTL_SECONDS = 30;

let refHash = (i: { regionOid: bigint; genesisId: string }) => `${i.regionOid}:${i.genesisId}`;

let getImageRef = createLocallyCachedFunction({
  getHash: refHash,
  ttlSeconds: REF_CACHE_TTL_SECONDS,
  provider: async (i: { regionOid: bigint; genesisId: string }) => {
    let row = await db.sandboxMachineImageRegion.findFirst({
      where: { regionOid: i.regionOid, genesisId: i.genesisId },
      select: { image: { select: { id: true } } }
    });

    return row?.image.id ?? null;
  }
});

let getImageVersionRef = createLocallyCachedFunction({
  getHash: refHash,
  ttlSeconds: REF_CACHE_TTL_SECONDS,
  provider: async (i: { regionOid: bigint; genesisId: string }) => {
    let row = await db.sandboxMachineImageVersionRegion.findFirst({
      where: { regionOid: i.regionOid, genesisId: i.genesisId },
      select: { version: { select: { id: true } } }
    });

    return row?.version.id ?? null;
  }
});

let getSpecRef = createLocallyCachedFunction({
  getHash: refHash,
  ttlSeconds: REF_CACHE_TTL_SECONDS,
  provider: async (i: { regionOid: bigint; genesisId: string }) => {
    let row = await db.sandboxSpecRegion.findFirst({
      where: { regionOid: i.regionOid, genesisId: i.genesisId },
      select: { spec: { select: { id: true } } }
    });

    return row?.spec.id ?? null;
  }
});

export let resolveSandboxImageRef = async (d: {
  regionOid: bigint;
  genesisImageId: string;
  genesisVersionId?: string | null;
}) => ({
  imageId: await getImageRef({ regionOid: d.regionOid, genesisId: d.genesisImageId }),
  versionId: d.genesisVersionId
    ? await getImageVersionRef({ regionOid: d.regionOid, genesisId: d.genesisVersionId })
    : null
});

export let resolveSandboxSpecId = async (d: { regionOid: bigint; genesisSpecId: string }) =>
  await getSpecRef({ regionOid: d.regionOid, genesisId: d.genesisSpecId });
