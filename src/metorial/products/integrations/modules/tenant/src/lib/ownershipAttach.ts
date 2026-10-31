import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { db, type Tenant } from '@metorial-subspace/db';
import { metorialDb } from './metorialDb';
import { effectiveOwnerActorOid } from './ownership';
import { assertCanAttachOwnedResources, type OwnershipAccessor } from './ownershipAccess';

type SubspaceResourceIds = {
  tenant: Pick<Tenant, 'oid'>;
  parent: { ownerActorOid?: bigint | null } | null | undefined;
  providerConfigIds?: (string | null | undefined)[];
  providerAuthConfigIds?: (string | null | undefined)[];
  integrationInstanceIds?: (string | null | undefined)[];
};

let loadSubspaceResources = async (d: SubspaceResourceIds) => {
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

  return { configs, authConfigs, integrationInstances };
};

let resolveSubspaceParentOwnerActorOid = async (d: SubspaceResourceIds) => {
  let parentOwnerActorId = d.parent?.ownerActorOid
    ? ((
        await metorialDb.identityActor.findUnique({
          where: { oid: d.parent.ownerActorOid },
          select: { id: true }
        })
      )?.id ?? null)
    : null;

  return parentOwnerActorId
    ? ((
        await db.identityActor.findFirst({
          where: { id: parentOwnerActorId, tenantOid: d.tenant.oid },
          select: { oid: true }
        })
      )?.oid ?? null)
    : null;
};

export let assertCanAttachSubspaceResourcesToCoreParent = async (
  d: SubspaceResourceIds & { accessor: OwnershipAccessor }
) => {
  if (!d.accessor.isEnforced || !d.parent) return;

  let { configs, authConfigs, integrationInstances } = await loadSubspaceResources(d);
  let subspaceParent = { ownerActorOid: await resolveSubspaceParentOwnerActorOid(d) };

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

export let assertSubspaceResourcesOwnedByCoreParent = async (d: SubspaceResourceIds) => {
  let { configs, authConfigs, integrationInstances } = await loadSubspaceResources(d);
  let resources = [
    ...configs.map(resource => ({ resource, name: 'provider config' })),
    ...authConfigs.map(resource => ({ resource, name: 'provider auth config' })),
    ...integrationInstances.map(resource => ({ resource, name: 'integration instance' }))
  ];
  if (!resources.length) return;

  let parentOwnerActorOid = await resolveSubspaceParentOwnerActorOid(d);

  for (let { resource, name } of resources) {
    if (!parentOwnerActorOid || effectiveOwnerActorOid(resource) !== parentOwnerActorOid) {
      throw new ServiceError(
        forbiddenError({ message: `You cannot attach this ${name} to this resource` })
      );
    }
  }
};
