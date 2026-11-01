import { notFoundError, ServiceError } from '@lowerdeck/error';
import { db, type Tenant } from '@metorial-subspace/db';
import { getOwnershipAccessor, ownedResourceWhere } from '@metorial-subspace/module-tenant';
import type { OrganizationActor } from '@metorial/db';

export let getSessionVisibilityWhere = async (d: {
  tenant: Tenant;
  organizationActor?: OrganizationActor;
}) => {
  if (!d.organizationActor) return undefined;

  let accessor = await getOwnershipAccessor({
    tenant: d.tenant,
    organizationActor: d.organizationActor
  });
  if (accessor.kind === 'internal' || !accessor.isEnforced) return undefined;

  return ownedResourceWhere(accessor, { ownership: 'all', includeSystemOwned: true });
};

export let getVisibleSessionOids = async (d: {
  tenant: Tenant;
  organizationActor?: OrganizationActor;
  sessionOids: bigint[];
}) => {
  let where = await getSessionVisibilityWhere(d);
  if (!where) return null;

  let visible = await db.session.findMany({
    where: { oid: { in: [...new Set(d.sessionOids)] }, AND: [where] },
    select: { oid: true }
  });
  return new Set(visible.map(session => session.oid));
};

export let assertSessionVisible = async (d: {
  tenant: Tenant;
  organizationActor?: OrganizationActor;
  sessionOid: bigint;
  resource: string;
  id: string;
}) => {
  let visible = await getVisibleSessionOids({ ...d, sessionOids: [d.sessionOid] });
  if (visible && !visible.has(d.sessionOid)) {
    throw new ServiceError(notFoundError(d.resource, d.id));
  }
};

export type SessionVisibilityWhere = Awaited<ReturnType<typeof getSessionVisibilityWhere>>;
