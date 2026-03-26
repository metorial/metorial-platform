import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { db } from '@metorial-subspace/db';
import { nativeProvider } from '@metorial-subspace/provider-native';
import { shuttleProvider } from '@metorial-subspace/provider-shuttle';
import { slatesProvider } from '@metorial-subspace/provider-slates';

let getBackendRecord = createLocallyCachedFunction({
  getHash: (backendOid: bigint) => backendOid.toString(),
  ttlSeconds: 60,
  provider: async backendOid =>
    await db.backend.findFirstOrThrow({
      where: { oid: backendOid }
    })
});

export let getBackend = async ({ entity }: { entity: { backendOid: bigint } }) => {
  let backend = await getBackendRecord(entity.backendOid);

  if (backend.type === 'native') return nativeProvider.create({ backend });
  if (backend.type === 'slates') return slatesProvider.create({ backend });
  if (backend.type === 'shuttle') return shuttleProvider.create({ backend });

  throw new Error(`Unsupported backend type: ${backend.type}`);
};
