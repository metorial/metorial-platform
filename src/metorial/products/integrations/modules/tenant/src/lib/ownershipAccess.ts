import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import type { OrganizationActor } from '@metorial/db';
import { db, type Tenant } from '@metorial-subspace/db';
import { metorialDb } from './metorialDb';
import { resolveMetorialFacing } from './metorialFacing';
import { effectiveOwnerActorOid, type OwnedResource } from './ownership';

export type OwnershipCallerKind = 'internal' | 'api' | 'member' | 'consumer';

export type OwnershipAccessor = {
  kind: OwnershipCallerKind;
  ownActorOids: bigint[];
  ownActorIds: string[];
  isRestrictedByProject: boolean;
  isEnforced: boolean;
  allowSystemOwned: boolean;
};

export type OwnershipFilter = 'shared' | 'usable' | 'all';

export let internalOwnershipAccessor: OwnershipAccessor = {
  kind: 'internal',
  ownActorOids: [],
  ownActorIds: [],
  isRestrictedByProject: false,
  isEnforced: false,
  allowSystemOwned: false
};

export let systemOwnershipAccessor: OwnershipAccessor = {
  ...internalOwnershipAccessor,
  allowSystemOwned: true
};

export let isOwnershipEnforced = (
  tenant: Pick<
    Tenant,
    'allowApiAccessToConsumerOwnedResources' | 'allowMemberAccessToConsumerOwnedResources'
  >
) =>
  !tenant.allowApiAccessToConsumerOwnedResources ||
  !tenant.allowMemberAccessToConsumerOwnedResources;

let ACCESSOR_CACHE_TTL_MS = 15_000;
let EMPTY_ACCESSOR_CACHE_TTL_MS = 2_000;
let accessorCache = new Map<
  string,
  { expiresAt: number; value: Promise<OwnershipAccessor> }
>();

let getCallerKind = (organizationActor?: Pick<OrganizationActor, 'type'>) => {
  if (!organizationActor) return 'internal' as const;
  if (organizationActor.type === 'machine_access') return 'api' as const;
  if (organizationActor.type === 'member') return 'member' as const;
  if (organizationActor.type === 'consumer_profile') return 'consumer' as const;
  return 'internal' as const;
};

let isRestrictedByProject = (
  kind: OwnershipCallerKind,
  tenant: Pick<
    Tenant,
    'allowApiAccessToConsumerOwnedResources' | 'allowMemberAccessToConsumerOwnedResources'
  >
) => {
  if (kind === 'api') return !tenant.allowApiAccessToConsumerOwnedResources;
  if (kind === 'member') return !tenant.allowMemberAccessToConsumerOwnedResources;
  return false;
};

let loadOwnActors = async (d: {
  tenant: Pick<Tenant, 'oid'>;
  organizationActor: Pick<OrganizationActor, 'oid'>;
}) => {
  let consumerActors = await metorialDb.consumerActor.findMany({
    where: {
      consumer: {
        OR: [
          { organizationActorOid: d.organizationActor.oid },
          { organizationMember: { actorOid: d.organizationActor.oid } },
          { profiles: { some: { organizationActorOid: d.organizationActor.oid } } }
        ]
      }
    },
    select: { id: true }
  });
  if (!consumerActors.length) return [];

  return await db.identityActor.findMany({
    where: {
      id: { in: consumerActors.map(consumerActor => consumerActor.id) },
      tenantOid: d.tenant.oid
    },
    select: { oid: true, id: true }
  });
};

export let getOwnershipAccessor = async (d: {
  tenant: Pick<
    Tenant,
    | 'oid'
    | 'allowApiAccessToConsumerOwnedResources'
    | 'allowMemberAccessToConsumerOwnedResources'
  >;
  organizationActor?: Pick<OrganizationActor, 'oid' | 'type'>;
}): Promise<OwnershipAccessor> => {
  let kind = getCallerKind(d.organizationActor);
  if (kind === 'internal' || !d.organizationActor) return internalOwnershipAccessor;

  let organizationActor = d.organizationActor;
  let cacheKey = `${d.tenant.oid}:${organizationActor.oid}`;
  let cached = accessorCache.get(cacheKey);
  let ownActorsPromise =
    cached && cached.expiresAt > Date.now()
      ? cached.value
      : (async () => {
          let ownActors = await loadOwnActors({ tenant: d.tenant, organizationActor });
          if (!ownActors.length) {
            let entry = accessorCache.get(cacheKey);
            if (entry) entry.expiresAt = Date.now() + EMPTY_ACCESSOR_CACHE_TTL_MS;
          }

          return {
            kind,
            ownActorOids: ownActors.map(actor => actor.oid),
            ownActorIds: ownActors.map(actor => actor.id),
            isRestrictedByProject: false,
            isEnforced: false,
            allowSystemOwned: false
          };
        })();

  if (!cached || cached.expiresAt <= Date.now()) {
    accessorCache.set(cacheKey, {
      expiresAt: Date.now() + ACCESSOR_CACHE_TTL_MS,
      value: ownActorsPromise
    });
    ownActorsPromise.catch(() => accessorCache.delete(cacheKey));
  }

  let ownActors = await ownActorsPromise;

  return {
    ...ownActors,
    kind,
    isRestrictedByProject: isRestrictedByProject(kind, d.tenant),
    isEnforced: isOwnershipEnforced(d.tenant)
  };
};

export let invalidateOwnershipAccessorForFacing = async (d: {
  instance: Parameters<typeof resolveMetorialFacing>[0]['instance'];
  organizationActor?: OrganizationActor;
}) => {
  if (!d.organizationActor) return;

  let { tenant } = await resolveMetorialFacing(d);
  accessorCache.delete(`${tenant.oid}:${d.organizationActor.oid}`);
};

export let getOwnershipAccessorForFacing = async (d: {
  instance: Parameters<typeof resolveMetorialFacing>[0]['instance'];
  organizationActor?: OrganizationActor;
}) => {
  if (!d.organizationActor) return internalOwnershipAccessor;

  let { tenant } = await resolveMetorialFacing(d);
  return await getOwnershipAccessor({ tenant, organizationActor: d.organizationActor });
};

let isConsumerActorOid = async (actorOid: bigint) => {
  let actor = await db.identityActor.findUnique({
    where: { oid: actorOid },
    select: { type: true }
  });
  return actor?.type === 'consumer';
};

export let canUseOwnedResource = async (
  accessor: OwnershipAccessor,
  resource: OwnedResource | null | undefined
) => {
  if (!resource) return true;
  if (resource.isSystemOwned) return accessor.allowSystemOwned;
  if (accessor.kind === 'internal') return true;

  let ownerActorOid = effectiveOwnerActorOid(resource);
  if (!ownerActorOid) return true;
  if (accessor.ownActorOids.includes(ownerActorOid)) return true;
  if (!(await isConsumerActorOid(ownerActorOid))) return true;
  if (resource.isOwnerLocked) return false;
  if (accessor.isEnforced && resource.isOwnerOnlyVisible) return false;

  return !accessor.isRestrictedByProject;
};

export let canSeeOwnedResource = (
  accessor: OwnershipAccessor,
  resource: OwnedResource | null | undefined
) => {
  if (!resource) return true;
  if (resource.isSystemOwned) return accessor.allowSystemOwned;
  if (accessor.kind === 'internal') return true;
  if (!accessor.isEnforced || !resource.isOwnerOnlyVisible) return true;

  let ownerActorOid = effectiveOwnerActorOid(resource);
  if (!ownerActorOid) return true;

  return accessor.ownActorOids.includes(ownerActorOid);
};

export let assertCanSeeOwnedResource = (
  accessor: OwnershipAccessor,
  resource: (OwnedResource & { id?: string }) | null | undefined,
  d: { resource: string; id: string }
) => {
  if (canSeeOwnedResource(accessor, resource)) return;
  throw new ServiceError(notFoundError(d.resource, d.id));
};

export let canUseCoreOwnedResource = async (
  accessor: OwnershipAccessor,
  resource:
    | {
        ownerActorOid?: bigint | null;
        isOwnerLocked?: boolean | null;
        isOwnerOnlyVisible?: boolean | null;
        isSystemOwned?: boolean | null;
      }
    | null
    | undefined
) => {
  if (resource?.isSystemOwned) return accessor.allowSystemOwned;
  if (!resource?.ownerActorOid || accessor.kind === 'internal') return true;

  let owner = await metorialDb.identityActor.findUnique({
    where: { oid: resource.ownerActorOid },
    select: { id: true, type: true }
  });
  if (!owner || owner.type !== 'consumer') return true;
  if (accessor.ownActorIds.includes(owner.id)) return true;
  if (resource.isOwnerLocked) return false;
  if (accessor.isEnforced && resource.isOwnerOnlyVisible) return false;

  return !accessor.isRestrictedByProject;
};

export let canSeeCoreOwnedResource = async (
  accessor: OwnershipAccessor,
  resource:
    | {
        ownerActorOid?: bigint | null;
        isOwnerOnlyVisible?: boolean | null;
        isSystemOwned?: boolean | null;
      }
    | null
    | undefined
) => {
  if (!resource) return true;
  if (resource.isSystemOwned) return accessor.allowSystemOwned;
  if (accessor.kind === 'internal') return true;
  if (!accessor.isEnforced || !resource.isOwnerOnlyVisible || !resource.ownerActorOid) {
    return true;
  }

  let owner = await metorialDb.identityActor.findUnique({
    where: { oid: resource.ownerActorOid },
    select: { id: true }
  });

  return !owner || accessor.ownActorIds.includes(owner.id);
};

export let assertCanSeeCoreOwnedResource = async (
  accessor: OwnershipAccessor,
  resource:
    | {
        ownerActorOid?: bigint | null;
        isOwnerOnlyVisible?: boolean | null;
        isSystemOwned?: boolean | null;
      }
    | null
    | undefined,
  d: { resource: string; id: string }
) => {
  if (await canSeeCoreOwnedResource(accessor, resource)) return;
  throw new ServiceError(notFoundError(d.resource, d.id));
};

export let ownershipRestrictedError = (d?: { resource?: string; id?: string }) =>
  new ServiceError(
    forbiddenError({
      code: 'ownership_restricted',
      message: d?.resource
        ? `This ${d.resource} is owned by a consumer and can't be used by you.`
        : "This resource is owned by a consumer and can't be used by you.",
      data: d?.id ? { id: d.id } : undefined
    })
  );

export let assertCanUseOwnedResource = async (
  accessor: OwnershipAccessor,
  resource: (OwnedResource & { id?: string }) | null | undefined,
  d?: { resource?: string }
) => {
  if (await canUseOwnedResource(accessor, resource)) return;
  throw ownershipRestrictedError({ resource: d?.resource, id: resource?.id });
};

export let assertCanChangeOwnerLock = async (
  accessor: OwnershipAccessor,
  resource: OwnedResource & { id?: string },
  isOwnerLocked: boolean | undefined,
  d?: { resource?: string }
) => {
  if (isOwnerLocked === undefined || isOwnerLocked === !!resource.isOwnerLocked) return;
  if (accessor.kind === 'internal') return;

  if (isOwnerLocked) {
    await assertCanUseOwnedResource(accessor, resource, d);
    return;
  }

  let ownerActorOid = effectiveOwnerActorOid(resource);
  if (!ownerActorOid || accessor.ownActorOids.includes(ownerActorOid)) return;

  throw new ServiceError(
    forbiddenError({
      code: 'ownership_restricted',
      message: `Only the owner can unlock this ${d?.resource ?? 'resource'}.`,
      data: resource.id ? { id: resource.id } : undefined
    })
  );
};

export let assertCanChangeCoreOwnerLock = async (
  accessor: OwnershipAccessor,
  resource: { id?: string; ownerActorOid?: bigint | null; isOwnerLocked?: boolean | null },
  isOwnerLocked: boolean | undefined,
  d?: { resource?: string }
) => {
  if (isOwnerLocked === undefined || isOwnerLocked === !!resource.isOwnerLocked) return;
  if (accessor.kind === 'internal') return;

  if (isOwnerLocked) {
    await assertCanUseCoreOwnedResources(accessor, [resource], d);
    return;
  }

  if (!resource.ownerActorOid) return;
  let owner = await metorialDb.identityActor.findUnique({
    where: { oid: resource.ownerActorOid },
    select: { id: true }
  });
  if (!owner || accessor.ownActorIds.includes(owner.id)) return;

  throw new ServiceError(
    forbiddenError({
      code: 'ownership_restricted',
      message: `Only the owner can unlock this ${d?.resource ?? 'resource'}.`,
      data: resource.id ? { id: resource.id } : undefined
    })
  );
};

export let assertCanUseOwnedResources = async (
  accessor: OwnershipAccessor,
  resources: ((OwnedResource & { id?: string }) | null | undefined)[],
  d?: { resource?: string }
) => {
  for (let resource of resources) {
    await assertCanUseOwnedResource(accessor, resource, d);
  }
};

export let usableOwnedResourceWhere = (
  accessor: OwnershipAccessor,
  d: { fallback?: { field: 'identityActorOid' | 'actorOid'; relation: string } } = {}
) => {
  if (accessor.kind === 'internal') return {};

  let ownActorOids = accessor.ownActorOids;
  let notConsumerOwned = (field: string, relation: string) => ({
    OR: [
      { [field]: null },
      { [relation]: { type: { not: 'consumer' as const } } },
      ...(ownActorOids.length ? [{ [field]: { in: ownActorOids } }] : [])
    ]
  });

  let usableOwner = d.fallback
    ? {
        OR: [
          { ownerActorOid: null, ...notConsumerOwned(d.fallback.field, d.fallback.relation) },
          { ownerActorOid: { not: null }, ...notConsumerOwned('ownerActorOid', 'ownerActor') }
        ]
      }
    : notConsumerOwned('ownerActorOid', 'ownerActor');

  if (accessor.isRestrictedByProject) return usableOwner;

  return {
    OR: [{ isOwnerLocked: false }, usableOwner]
  };
};

export let usableCoreOwnedResourceWhere = (accessor: OwnershipAccessor) => {
  if (accessor.kind === 'internal') return {};

  let usableOwner = {
    OR: [
      { ownerActorOid: null },
      { ownerActor: { type: { not: 'consumer' as const } } },
      ...(accessor.ownActorIds.length
        ? [{ ownerActor: { id: { in: accessor.ownActorIds } } }]
        : [])
    ]
  };

  if (accessor.isRestrictedByProject) return usableOwner;

  return { OR: [{ isOwnerLocked: false }, usableOwner] };
};

export let ownedResourceWhere = (
  accessor: OwnershipAccessor,
  d: {
    ownership?: OwnershipFilter;
    includeSystemOwned?: boolean;
    fallback?: { field: 'identityActorOid' | 'actorOid'; relation: string };
  } = {}
) => {
  let ownership = d.ownership ?? (accessor.isEnforced ? 'shared' : 'all');
  let conditions: Record<string, any>[] = [];

  if (!(d.includeSystemOwned ?? accessor.allowSystemOwned)) {
    conditions.push({ isSystemOwned: false });
  }

  if (accessor.kind === 'internal') return { AND: conditions };

  if (accessor.isEnforced) {
    conditions.push({
      OR: [
        { isOwnerOnlyVisible: false },
        ...(accessor.ownActorOids.length
          ? [{ ownerActorOid: { in: accessor.ownActorOids } }]
          : [])
      ]
    });
  }

  if (ownership === 'usable') {
    conditions.push(usableOwnedResourceWhere(accessor, { fallback: d.fallback }));
  }

  if (ownership === 'shared') {
    let notConsumerOwned = (field: string, relation: string) => ({
      OR: [{ [field]: null }, { [relation]: { type: { not: 'consumer' as const } } }]
    });

    conditions.push(
      d.fallback
        ? {
            OR: [
              {
                ownerActorOid: null,
                ...notConsumerOwned(d.fallback.field, d.fallback.relation)
              },
              {
                ownerActorOid: { not: null },
                ...notConsumerOwned('ownerActorOid', 'ownerActor')
              }
            ]
          }
        : notConsumerOwned('ownerActorOid', 'ownerActor')
    );
  }

  return { AND: conditions };
};

export let ownedCoreResourceWhere = (
  accessor: OwnershipAccessor,
  d: { ownership?: OwnershipFilter; includeSystemOwned?: boolean } = {}
) => {
  let ownership = d.ownership ?? (accessor.isEnforced ? 'shared' : 'all');
  let conditions: Record<string, any>[] = [];

  if (!(d.includeSystemOwned ?? accessor.allowSystemOwned)) {
    conditions.push({ isSystemOwned: false });
  }

  if (accessor.kind === 'internal') return { AND: conditions };

  if (accessor.isEnforced) {
    conditions.push({
      OR: [
        { isOwnerOnlyVisible: false },
        ...(accessor.ownActorIds.length
          ? [{ ownerActor: { id: { in: accessor.ownActorIds } } }]
          : [])
      ]
    });
  }

  if (ownership === 'usable') conditions.push(usableCoreOwnedResourceWhere(accessor));

  if (ownership === 'shared') {
    conditions.push({
      OR: [{ ownerActorOid: null }, { ownerActor: { type: { not: 'consumer' as const } } }]
    });
  }

  return { AND: conditions };
};

export let assertCanChangeOwnerOnlyVisibility = async (
  accessor: OwnershipAccessor,
  resource: OwnedResource & { id?: string },
  isOwnerOnlyVisible: boolean | undefined,
  d?: { resource?: string }
) => {
  if (isOwnerOnlyVisible === undefined) return;
  if (isOwnerOnlyVisible === !!resource.isOwnerOnlyVisible) return;
  if (accessor.kind === 'internal') return;

  if (isOwnerOnlyVisible) {
    if (!accessor.isEnforced) {
      throw new ServiceError(
        badRequestError({
          message: 'Owner-only visibility is only available when ownership is enforced.'
        })
      );
    }

    if (!effectiveOwnerActorOid(resource)) {
      throw new ServiceError(
        badRequestError({
          message: `Only owned resources can be made owner-only visible. This ${d?.resource ?? 'resource'} has no owner.`
        })
      );
    }

    await assertCanUseOwnedResource(accessor, resource, d);
    return;
  }

  let ownerActorOid = effectiveOwnerActorOid(resource);
  if (!ownerActorOid || accessor.ownActorOids.includes(ownerActorOid)) return;

  throw new ServiceError(
    forbiddenError({
      code: 'ownership_restricted',
      message: `Only the owner can make this ${d?.resource ?? 'resource'} visible to others.`,
      data: resource.id ? { id: resource.id } : undefined
    })
  );
};

export let assertCanChangeCoreOwnerOnlyVisibility = async (
  accessor: OwnershipAccessor,
  resource: {
    id?: string;
    ownerActorOid?: bigint | null;
    isOwnerLocked?: boolean | null;
    isOwnerOnlyVisible?: boolean | null;
  },
  isOwnerOnlyVisible: boolean | undefined,
  d?: { resource?: string }
) => {
  if (isOwnerOnlyVisible === undefined) return;
  if (isOwnerOnlyVisible === !!resource.isOwnerOnlyVisible) return;
  if (accessor.kind === 'internal') return;

  if (isOwnerOnlyVisible) {
    if (!accessor.isEnforced) {
      throw new ServiceError(
        badRequestError({
          message: 'Owner-only visibility is only available when ownership is enforced.'
        })
      );
    }

    if (!resource.ownerActorOid) {
      throw new ServiceError(
        badRequestError({
          message: `Only owned resources can be made owner-only visible. This ${d?.resource ?? 'resource'} has no owner.`
        })
      );
    }

    await assertCanUseCoreOwnedResources(accessor, [resource], d);
    return;
  }

  if (!resource.ownerActorOid) return;
  let owner = await metorialDb.identityActor.findUnique({
    where: { oid: resource.ownerActorOid },
    select: { id: true }
  });
  if (!owner || accessor.ownActorIds.includes(owner.id)) return;

  throw new ServiceError(
    forbiddenError({
      code: 'ownership_restricted',
      message: `Only the owner can make this ${d?.resource ?? 'resource'} visible to others.`,
      data: resource.id ? { id: resource.id } : undefined
    })
  );
};

export let ownershipAttachRestrictedError = (d?: { resource?: string; id?: string }) =>
  new ServiceError(
    forbiddenError({
      code: 'ownership_restricted',
      message: `This ${d?.resource ?? 'resource'} is owned by someone else and can't be attached to a resource with a different owner.`,
      data: d?.id ? { id: d.id } : undefined
    })
  );

export let assertCanAttachOwnedResources = async (
  accessor: OwnershipAccessor,
  parent: { ownerActorOid?: bigint | null } | null | undefined,
  children: ((OwnedResource & { id?: string }) | null | undefined)[],
  d?: { resource?: string }
) => {
  if (!accessor.isEnforced || !parent) return;

  for (let child of children) {
    let childOwnerActorOid = child ? effectiveOwnerActorOid(child) : null;
    if (!child || !childOwnerActorOid) continue;
    if (childOwnerActorOid === (parent.ownerActorOid ?? null)) continue;
    if (!(await isConsumerActorOid(childOwnerActorOid))) continue;

    throw ownershipAttachRestrictedError({ resource: d?.resource, id: child.id });
  }
};

export let assertCanAttachCoreOwnedResources = async (
  accessor: OwnershipAccessor,
  parent: { ownerActorOid?: bigint | null } | null | undefined,
  children: ({ id?: string; ownerActorOid?: bigint | null } | null | undefined)[],
  d?: { resource?: string }
) => {
  if (!accessor.isEnforced || !parent) return;

  for (let child of children) {
    if (!child?.ownerActorOid) continue;
    if (child.ownerActorOid === (parent.ownerActorOid ?? null)) continue;

    let owner = await metorialDb.identityActor.findUnique({
      where: { oid: child.ownerActorOid },
      select: { type: true }
    });
    if (owner?.type !== 'consumer') continue;

    throw ownershipAttachRestrictedError({ resource: d?.resource, id: child.id });
  }
};

export let assertCanUseCoreOwnedResources = async (
  accessor: OwnershipAccessor,
  resources: (
    | { id?: string; ownerActorOid?: bigint | null; isOwnerLocked?: boolean | null }
    | null
    | undefined
  )[],
  d?: { resource?: string }
) => {
  for (let resource of resources) {
    if (await canUseCoreOwnedResource(accessor, resource)) continue;
    throw ownershipRestrictedError({ resource: d?.resource, id: resource?.id });
  }
};

export let assertCanUseSubspaceResources = async (d: {
  accessor: OwnershipAccessor;
  tenant: Pick<Tenant, 'oid'>;
  providerConfigIds?: (string | null | undefined)[];
  providerAuthConfigIds?: (string | null | undefined)[];
  integrationInstanceIds?: (string | null | undefined)[];
  sessionTemplateIds?: (string | null | undefined)[];
}) => {
  let ids = (values?: (string | null | undefined)[]) =>
    (values ?? []).filter((value): value is string => !!value);
  let where = (values?: (string | null | undefined)[]) => ({
    id: { in: ids(values) },
    tenantOid: d.tenant.oid
  });

  let [configs, authConfigs, integrationInstances, sessionTemplates] = await Promise.all([
    ids(d.providerConfigIds).length
      ? db.providerConfig.findMany({ where: where(d.providerConfigIds) })
      : [],
    ids(d.providerAuthConfigIds).length
      ? db.providerAuthConfig.findMany({ where: where(d.providerAuthConfigIds) })
      : [],
    ids(d.integrationInstanceIds).length
      ? db.integrationInstance.findMany({ where: where(d.integrationInstanceIds) })
      : [],
    ids(d.sessionTemplateIds).length
      ? db.sessionTemplate.findMany({ where: where(d.sessionTemplateIds) })
      : []
  ]);

  await assertCanUseOwnedResources(d.accessor, configs, { resource: 'provider config' });
  await assertCanUseOwnedResources(d.accessor, authConfigs, {
    resource: 'provider auth config'
  });
  await assertCanUseOwnedResources(d.accessor, integrationInstances, {
    resource: 'integration instance'
  });
  await assertCanUseOwnedResources(d.accessor, sessionTemplates, {
    resource: 'session template'
  });
};

export let assertCanUseSessionById = async (d: {
  instance: Parameters<typeof resolveMetorialFacing>[0]['instance'];
  organizationActor?: OrganizationActor;
  sessionId: string;
}) => {
  let { tenant, environment } = await resolveMetorialFacing(d);
  let session = await db.session.findFirst({
    where: { id: d.sessionId, tenantOid: tenant.oid, environmentOid: environment.oid },
    select: {
      id: true,
      ownerActorOid: true,
      identityActorOid: true,
      isOwnerLocked: true,
      isOwnerOnlyVisible: true,
      isSystemOwned: true
    }
  });
  if (!session) return;

  let accessor = d.organizationActor
    ? await getOwnershipAccessor({ tenant, organizationActor: d.organizationActor })
    : internalOwnershipAccessor;
  await assertCanUseOwnedResource(accessor, session, { resource: 'session' });
};

export type OwnershipFacing = {
  instance: Parameters<typeof resolveMetorialFacing>[0]['instance'];
  organizationActor?: OrganizationActor;
};

export type RedactableOwnedResource = OwnedResource & { clientSecret: string };

export let redactClientSecretsForCaller = async <T extends RedactableOwnedResource>(
  d: OwnershipFacing & { resources: T[] }
) => {
  let accessor = await getOwnershipAccessorForFacing(d);
  if (accessor.kind === 'internal') return d.resources;

  return await Promise.all(
    d.resources.map(async resource =>
      (await canUseOwnedResource(accessor, resource))
        ? resource
        : { ...resource, clientSecret: '' }
    )
  );
};
