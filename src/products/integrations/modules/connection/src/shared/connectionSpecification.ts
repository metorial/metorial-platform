import { db, getId } from '@metorial-subspace/db';
import { requestSecurityReview } from '@metorial-subspace/module-security-review-request';

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

  let record = await db.sessionConnectionProviderSpecification.upsert({
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

  if (d.specificationOid) await requestCensusReview(d.providerVersionOid);

  return record;
};

let requestCensusReview = async (providerVersionOid: bigint) => {
  let providerVersion = await db.providerVersion.findUnique({
    where: { oid: providerVersionOid },
    select: { id: true, slateVersionOid: true }
  });
  if (!providerVersion || providerVersion.slateVersionOid) return;

  await requestSecurityReview({
    subject: 'providerVersion',
    id: providerVersion.id,
    trigger: 'census_changed'
  });
};
