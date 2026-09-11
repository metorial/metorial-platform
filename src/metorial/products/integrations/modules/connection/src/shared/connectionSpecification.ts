import { db, getId } from '@metorial-subspace/db';

export let getConnectionProviderSpecification = async (d: {
  connectionOid: bigint;
  sessionProviderOid: bigint;
}) =>
  await db.sessionConnectionProviderSpecification.findUnique({
    where: {
      connectionOid_sessionProviderOid: {
        connectionOid: d.connectionOid,
        sessionProviderOid: d.sessionProviderOid
      }
    }
  });

export let setConnectionProviderSpecification = async (d: {
  connectionOid: bigint;
  sessionProviderOid: bigint;
  providerVersionOid: bigint;
  specificationOid: bigint | null;
  error: PrismaJson.ProviderConnectionDiscoveryError;
}) => {
  let data = {
    status: d.specificationOid ? ('discovered' as const) : ('failed' as const),
    specificationOid: d.specificationOid,
    error: d.error,
    providerVersionOid: d.providerVersionOid,
    discoveredAt: d.specificationOid ? new Date() : null
  };

  return await db.sessionConnectionProviderSpecification.upsert({
    where: {
      connectionOid_sessionProviderOid: {
        connectionOid: d.connectionOid,
        sessionProviderOid: d.sessionProviderOid
      }
    },
    create: {
      ...getId('sessionConnectionProviderSpecification'),
      connectionOid: d.connectionOid,
      sessionProviderOid: d.sessionProviderOid,
      ...data
    },
    update: data
  });
};
