import { db, type Tenant } from '@metorial-subspace/db';
import { metorialDb } from './metorialDb';
import { assertCanAttachOwnedResources, type OwnershipAccessor } from './ownershipAccess';

export let assertCanAttachSubspaceResourcesToCoreParent = async (d: {
  accessor: OwnershipAccessor;
  tenant: Pick<Tenant, 'oid'>;
  parent: { ownerActorOid?: bigint | null } | null | undefined;
  providerConfigIds?: (string | null | undefined)[];
  providerAuthConfigIds?: (string | null | undefined)[];
  integrationInstanceIds?: (string | null | undefined)[];
}) => {
  if (!d.accessor.isEnforced || !d.parent) return;

  let ids = (values?: (string | null | undefined)[]) =>
    (values ?? []).filter((value): value is string => !!value);
  let where = (values?: (string | null | undefined)[]) => ({
    id: { in: ids(values) },
    tenantOid: d.tenant.oid
  });

  let [configs, authConfigs, integrationInstances] = await Promise.all([
    ids(d.providerConfigIds).length
      ? db.providerConfig.findMany({ where: where(d.providerConfigIds) })
      : [],
    ids(d.providerAuthConfigIds).length
      ? db.providerAuthConfig.findMany({ where: where(d.providerAuthConfigIds) })
      : [],
    ids(d.integrationInstanceIds).length
      ? db.integrationInstance.findMany({ where: where(d.integrationInstanceIds) })
      : []
  ]);

  let parentOwnerActorId = d.parent.ownerActorOid
    ? ((
        await metorialDb.identityActor.findUnique({
          where: { oid: d.parent.ownerActorOid },
          select: { id: true }
        })
      )?.id ?? null)
    : null;

  let subspaceParentOwnerActorOid = parentOwnerActorId
    ? ((
        await db.identityActor.findFirst({
          where: { id: parentOwnerActorId, tenantOid: d.tenant.oid },
          select: { oid: true }
        })
      )?.oid ?? null)
    : null;

  let subspaceParent = { ownerActorOid: subspaceParentOwnerActorOid };

  await assertCanAttachOwnedResources(d.accessor, subspaceParent, configs, {
    resource: 'provider config'
  });
  await assertCanAttachOwnedResources(d.accessor, subspaceParent, authConfigs, {
    resource: 'provider auth config'
  });
  await assertCanAttachOwnedResources(d.accessor, subspaceParent, integrationInstances, {
    resource: 'integration instance'
  });
};
