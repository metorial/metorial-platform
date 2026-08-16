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
