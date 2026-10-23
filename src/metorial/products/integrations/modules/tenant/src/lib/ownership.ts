import { notFoundError, ServiceError } from '@lowerdeck/error';
import { db, type Environment, type Tenant } from '@metorial-subspace/db';

export type ResourceOwner = {
  ownerActorOid: bigint | null;
  isOwnerLocked: boolean;
};

export type OwnedResource = {
  ownerActorOid?: bigint | null;
  identityActorOid?: bigint | null;
  actorOid?: bigint | null;
  isOwnerLocked?: boolean | null;
};

export let effectiveOwnerActorOid = (resource: OwnedResource) =>
  resource.ownerActorOid ?? resource.identityActorOid ?? resource.actorOid ?? null;

export let getConsumerOwnerActorId = (d: {
  privateMetadata?: Record<string, any> | null;
  identityActorId?: string | null;
}) => (d.privateMetadata?.$owner === 'consumer' ? (d.identityActorId ?? null) : null);

type OwnerActorLookup = {
  tenant: Pick<Tenant, 'oid'>;
  environment: Pick<Environment, 'oid'>;
  ownerActorId?: string | null;
};

export let findOwnerActorOid = async (d: OwnerActorLookup) => {
  if (!d.ownerActorId) return null;

  let actor = await db.identityActor.findFirst({
    where: {
      id: d.ownerActorId,
      tenantOid: d.tenant.oid,
      environmentOid: d.environment.oid
    },
    select: { oid: true }
  });

  return actor?.oid ?? null;
};

export let resolveOwnerActorOid = async (d: OwnerActorLookup) => {
  if (!d.ownerActorId) return null;

  let ownerActorOid = await findOwnerActorOid(d);
  if (!ownerActorOid) throw new ServiceError(notFoundError('identity.actor', d.ownerActorId));

  return ownerActorOid;
};

export let mergeResourceOwners = (
  ...owners: (Partial<OwnedResource> | null | undefined)[]
): ResourceOwner => ({
  ownerActorOid:
    owners.map(owner => owner?.ownerActorOid ?? null).find(oid => oid !== null) ?? null,
  isOwnerLocked: owners.some(owner => !!owner?.isOwnerLocked)
});
