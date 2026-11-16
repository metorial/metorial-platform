import { db, type Tenant } from '@metorial-subspace/db';
import { metorialDb } from './metorialDb';
import { effectiveOwnerActorOid, type OwnedResource } from './ownership';
import {
  assertCanAttachOwnedResources,
  ownershipAttachRestrictedError,
  type OwnershipAccessor
} from './ownershipAccess';

type SubspaceResourceIds = {
  tenant: Pick<Tenant, 'oid'>;
  parent: { ownerActorOid?: bigint | null } | null | undefined;
  providerConfigIds?: (string | null | undefined)[];
  providerAuthConfigIds?: (string | null | undefined)[];
  integrationInstanceIds?: (string | null | undefined)[];
};

type ConsumerSubspaceResourceIds = SubspaceResourceIds & {
  parentIntegrationInstanceId?: string | null;
  inheritedProviderConfigIds?: (string | null | undefined)[];
};

type ConsumerAttachableResource = OwnedResource & {
  id?: string;
  owningIntegrationInstanceOid?: bigint | null;
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

let resolveParentIntegrationInstanceOid = async (d: ConsumerSubspaceResourceIds) => {
  if (!d.parentIntegrationInstanceId) return null;

  let integrationInstance = await db.integrationInstance.findFirst({
    where: { id: d.parentIntegrationInstanceId, tenantOid: d.tenant.oid },
    select: { oid: true }
  });

  return integrationInstance?.oid ?? null;
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

export let assertConsumerCanAttachSubspaceResources = async (
  d: ConsumerSubspaceResourceIds
) => {
  if (!d.parent) return;

  let { configs, authConfigs, integrationInstances } = await loadSubspaceResources(d);
  let [parentOwnerActorOid, parentIntegrationInstanceOid] = await Promise.all([
    resolveSubspaceParentOwnerActorOid(d),
    resolveParentIntegrationInstanceOid(d)
  ]);

  let isParentUnowned = !d.parent.ownerActorOid;
  let isPartOfParent = (child: ConsumerAttachableResource) =>
    !!parentIntegrationInstanceOid &&
    child.owningIntegrationInstanceOid === parentIntegrationInstanceOid;

  let assertOwnedByParent = (
    children: ConsumerAttachableResource[],
    resource: string,
    isInherited: (child: ConsumerAttachableResource) => boolean = () => false
  ) => {
    for (let child of children) {
      let childOwnerActorOid = effectiveOwnerActorOid(child);
      if (childOwnerActorOid && childOwnerActorOid === parentOwnerActorOid) continue;
      if (!childOwnerActorOid && isParentUnowned) continue;
      if (!childOwnerActorOid && (isPartOfParent(child) || isInherited(child))) continue;

      throw ownershipAttachRestrictedError({ resource, id: child.id });
    }
  };

  assertOwnedByParent(
    configs,
    'provider config',
    config => !!config.id && !!d.inheritedProviderConfigIds?.includes(config.id)
  );
  assertOwnedByParent(authConfigs, 'provider auth config');
  assertOwnedByParent(integrationInstances, 'integration instance');
};
