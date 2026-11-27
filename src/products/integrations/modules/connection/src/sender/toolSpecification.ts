import { db } from '@metorial-subspace/db';

export let resolveProviderToolListingSpecificationOid = async (d: {
  pairVersion: {
    specificationOid: bigint | null;
    versionOid: bigint;
  };
}) => {
  if (d.pairVersion.specificationOid) return d.pairVersion.specificationOid;

  let version = await db.providerVersion.findFirst({
    where: { oid: d.pairVersion.versionOid },
    select: { specificationOid: true }
  });

  return version?.specificationOid ?? null;
};
