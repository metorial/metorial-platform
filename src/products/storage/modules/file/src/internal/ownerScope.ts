import { notFoundError, ServiceError } from '@lowerdeck/error';
import { db } from '@metorial/db';

export type InstanceScope = {
  project: { oid: bigint };
  instance: { oid: bigint };
};

export type OwnerScope =
  | { user: { oid: bigint } }
  | { organization: { oid: bigint } }
  | InstanceScope;

export type CargoOwnerScope = OwnerScope;

export type CargoFileScope = {
  userOid: bigint | null;
  organizationOid: bigint | null;
  instanceOid: bigint | null;
};

export type ScopeOwner =
  | {
      type: 'user';
      user: { id: string };
    }
  | {
      type: 'organization';
      organization: { id: string };
    }
  | {
      type: 'instance';
      instance: { id: string };
    };

export let cargoFileScope = (scope: OwnerScope): CargoFileScope => ({
  userOid: 'user' in scope ? scope.user.oid : null,
  organizationOid: 'organization' in scope ? scope.organization.oid : null,
  instanceOid: 'instance' in scope ? scope.instance.oid : null
});

export let cargoOwnerScopeInstance = (scope: OwnerScope) =>
  'instance' in scope ? scope.instance : null;

export let cargoOwnerScopeProject = (scope: OwnerScope) =>
  'project' in scope ? scope.project : undefined;

export let resolveInstanceScope = async (instance: { id: string }): Promise<InstanceScope> => {
  let loaded = await db.instance.findUnique({
    where: { id: instance.id },
    select: { oid: true, projectOid: true }
  });
  if (!loaded) throw new ServiceError(notFoundError('instance', instance.id));

  return {
    project: { oid: loaded.projectOid },
    instance: { oid: loaded.oid }
  };
};

export let resolveOwnerScope = async (owner: ScopeOwner): Promise<OwnerScope> => {
  if (owner.type === 'instance') return await resolveInstanceScope(owner.instance);

  if (owner.type === 'user') {
    let user = await db.user.findUnique({
      where: { id: owner.user.id },
      select: { oid: true }
    });
    if (!user) throw new ServiceError(notFoundError('user', owner.user.id));

    return { user: { oid: user.oid } };
  }

  let organization = await db.organization.findUnique({
    where: { id: owner.organization.id },
    select: { oid: true }
  });
  if (!organization) {
    throw new ServiceError(notFoundError('organization', owner.organization.id));
  }

  return { organization: { oid: organization.oid } };
};
