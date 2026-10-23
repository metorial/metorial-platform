import { forbiddenError, ServiceError } from '@lowerdeck/error';
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
};

export let internalOwnershipAccessor: OwnershipAccessor = {
  kind: 'internal',
  ownActorOids: [],
  ownActorIds: [],
  isRestrictedByProject: false
};

let ACCESSOR_CACHE_TTL_MS = 15_000;
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
          return {
            kind,
            ownActorOids: ownActors.map(actor => actor.oid),
            ownActorIds: ownActors.map(actor => actor.id),
            isRestrictedByProject: false
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
    isRestrictedByProject: isRestrictedByProject(kind, d.tenant)
  };
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
  if (!resource || accessor.kind === 'internal') return true;

  let ownerActorOid = effectiveOwnerActorOid(resource);
  if (!ownerActorOid) return true;
  if (accessor.ownActorOids.includes(ownerActorOid)) return true;
  if (!(await isConsumerActorOid(ownerActorOid))) return true;
  if (resource.isOwnerLocked) return false;

  return !accessor.isRestrictedByProject;
};

export let canUseCoreOwnedResource = async (
  accessor: OwnershipAccessor,
  resource:
    { ownerActorOid?: bigint | null; isOwnerLocked?: boolean | null } | null | undefined
) => {
  if (!resource?.ownerActorOid || accessor.kind === 'internal') return true;

  let owner = await metorialDb.identityActor.findUnique({
    where: { oid: resource.ownerActorOid },
    select: { id: true, type: true }
  });
  if (!owner || owner.type !== 'consumer') return true;
  if (accessor.ownActorIds.includes(owner.id)) return true;
  if (resource.isOwnerLocked) return false;

  return !accessor.isRestrictedByProject;
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
  if (accessor.kind === 'internal') return;
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

export let assertCanUseCoreOwnedResources = async (
  accessor: OwnershipAccessor,
  resources: (
    | { id?: string; ownerActorOid?: bigint | null; isOwnerLocked?: boolean | null }
    | null
    | undefined
  )[],
  d?: { resource?: string }
) => {
  if (accessor.kind === 'internal') return;
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
  if (d.accessor.kind === 'internal') return;

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
  if (!d.organizationActor) return;

  let { tenant, environment } = await resolveMetorialFacing(d);
  let session = await db.session.findFirst({
    where: { id: d.sessionId, tenantOid: tenant.oid, environmentOid: environment.oid },
    select: { id: true, ownerActorOid: true, identityActorOid: true, isOwnerLocked: true }
  });
  if (!session) return;

  let accessor = await getOwnershipAccessor({
    tenant,
    organizationActor: d.organizationActor
  });
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
