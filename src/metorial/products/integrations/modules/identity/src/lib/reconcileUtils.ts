import { IdentityDelegationPermissions } from '@metorial-subspace/db';

export let getPermissions = (entities: { permissions: IdentityDelegationPermissions[] }[]) => {
  let currentGlobalPermissions = new Set<IdentityDelegationPermissions>();

  for (let entity of entities) {
    for (let permission of entity.permissions) {
      currentGlobalPermissions.add(permission);
    }
  }

  return currentGlobalPermissions;
};

export let getMaxExpirationThatFulfilsPermissions = (
  requiredPermissions: Set<IdentityDelegationPermissions>,
  entities: {
    permissions: IdentityDelegationPermissions[];
    expiresAt: Date | null;
  }[]
) => {
  let maxExpirationThatFulfilsPermissions: number = -1;

  for (let entity of entities) {
    let entityMaxExpiration = entity.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
    if (entityMaxExpiration <= maxExpirationThatFulfilsPermissions) continue;

    let hasAllPermissions = true;
    for (let permission of requiredPermissions) {
      if (!entity.permissions.includes(permission)) {
        hasAllPermissions = false;
        break;
      }
    }

    if (hasAllPermissions) {
      maxExpirationThatFulfilsPermissions = entityMaxExpiration;
    }
  }

  if (maxExpirationThatFulfilsPermissions <= 0) {
    maxExpirationThatFulfilsPermissions = Math.min(
      ...entities.map(d => d.expiresAt?.getTime()!).filter(Boolean)
    );
  }

  if (maxExpirationThatFulfilsPermissions <= 0) {
    maxExpirationThatFulfilsPermissions = 0;
  }

  return maxExpirationThatFulfilsPermissions === Number.POSITIVE_INFINITY
    ? null
    : new Date(maxExpirationThatFulfilsPermissions);
};
