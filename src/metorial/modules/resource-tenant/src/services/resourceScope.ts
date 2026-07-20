import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { db, ResourceGroup, ResourceTenant } from '@metorial/db';
import { resourceGroupService } from './resourceGroup';
import { resourceTenantService } from './resourceTenant';

export type ResourceScope = {
  resourceTenant: ResourceTenant;
  resourceGroup: ResourceGroup;
};

export type ResourceScopeOwner =
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

let getOwnerId = (owner: ResourceScopeOwner) =>
  owner.type === 'user'
    ? owner.user.id
    : owner.type === 'organization'
      ? owner.organization.id
      : owner.instance.id;

let ensureUserResourceScope = async (userId: string): Promise<ResourceScope> => {
  let user = await db.user.findUnique({
    where: { id: userId }
  });
  if (!user) throw new ServiceError(notFoundError('resourceScope', userId));

  let resourceTenant = await resourceTenantService.upsertResourceTenant({
    input: {
      identifier: `mte-usr-${user.oid}`,
      name: user.name
    }
  });
  let resourceGroup = await resourceGroupService.upsertResourceGroup({
    resourceTenant,
    input: {
      identifier: 'default',
      name: 'Default',
      type: 'production'
    }
  });

  await db.user.update({
    where: { oid: user.oid },
    data: {
      resourceTenantOid: resourceTenant.oid,
      resourceGroupOid: resourceGroup.oid
    }
  });

  return { resourceTenant, resourceGroup };
};

let ensureOrganizationResourceScope = async (
  organizationId: string
): Promise<ResourceScope> => {
  let organization = await db.organization.findUnique({
    where: { id: organizationId }
  });
  if (!organization) {
    throw new ServiceError(notFoundError('resourceScope', organizationId));
  }

  let resourceTenant = await resourceTenantService.upsertResourceTenant({
    input: {
      identifier: `mte-org-${organization.oid}`,
      name: organization.name
    }
  });
  let resourceGroup = await resourceGroupService.upsertResourceGroup({
    resourceTenant,
    input: {
      identifier: 'default',
      name: 'Default',
      type: 'production'
    }
  });

  await db.organization.update({
    where: { oid: organization.oid },
    data: {
      resourceTenantOid: resourceTenant.oid,
      resourceGroupOid: resourceGroup.oid
    }
  });

  return { resourceTenant, resourceGroup };
};

let ensureInstanceResourceScope = async (instanceId: string): Promise<ResourceScope> => {
  let instance = await db.instance.findUnique({
    where: { id: instanceId },
    include: {
      project: true
    }
  });
  if (!instance) throw new ServiceError(notFoundError('resourceScope', instanceId));

  let resourceTenant = await resourceTenantService.upsertResourceTenant({
    input: {
      identifier: `mte-pro-${instance.project.oid}`,
      name: instance.project.name
    }
  });
  let resourceGroup = await resourceGroupService.upsertResourceGroup({
    resourceTenant,
    input: {
      identifier: `mte-ins-${instance.oid}`,
      name: instance.name,
      type: instance.type
    }
  });

  await db.$transaction([
    db.project.update({
      where: { oid: instance.projectOid },
      data: {
        resourceTenantOid: resourceTenant.oid
      }
    }),
    db.instance.update({
      where: { oid: instance.oid },
      data: {
        resourceTenantOid: resourceTenant.oid,
        resourceGroupOid: resourceGroup.oid
      }
    })
  ]);

  return { resourceTenant, resourceGroup };
};

export let resolveResourceScopeForOwner = async (
  owner: ResourceScopeOwner
): Promise<ResourceScope> => {
  let ownerId = getOwnerId(owner);
  let linkedScope =
    owner.type === 'user'
      ? await db.user.findUnique({
          where: { id: ownerId },
          select: {
            resourceTenantOid: true,
            resourceGroupOid: true
          }
        })
      : owner.type === 'organization'
        ? await db.organization.findUnique({
            where: { id: ownerId },
            select: {
              resourceTenantOid: true,
              resourceGroupOid: true
            }
          })
        : await db.instance.findUnique({
            where: { id: ownerId },
            select: {
              resourceTenantOid: true,
              resourceGroupOid: true
            }
          });

  if (!linkedScope?.resourceTenantOid || !linkedScope.resourceGroupOid) {
    return owner.type === 'user'
      ? await ensureUserResourceScope(ownerId)
      : owner.type === 'organization'
        ? await ensureOrganizationResourceScope(ownerId)
        : await ensureInstanceResourceScope(ownerId);
  }

  let [resourceTenant, resourceGroup] = await Promise.all([
    db.resourceTenant.findUnique({
      where: { oid: linkedScope.resourceTenantOid }
    }),
    db.resourceGroup.findFirst({
      where: {
        oid: linkedScope.resourceGroupOid,
        resourceTenantOid: linkedScope.resourceTenantOid
      }
    })
  ]);

  if (!resourceTenant || !resourceGroup) {
    return owner.type === 'user'
      ? await ensureUserResourceScope(ownerId)
      : owner.type === 'organization'
        ? await ensureOrganizationResourceScope(ownerId)
        : await ensureInstanceResourceScope(ownerId);
  }

  return {
    resourceTenant,
    resourceGroup
  };
};

export let resolveInstanceResourceScope = async (scope: ResourceScope) => {
  let instance = await db.instance.findFirst({
    where: {
      resourceTenantOid: scope.resourceTenant.oid,
      resourceGroupOid: scope.resourceGroup.oid
    },
    select: {
      oid: true,
      organizationOid: true
    }
  });

  if (!instance) {
    throw new ServiceError(
      badRequestError({
        message: 'This operation requires a ResourceGroup linked to an instance.'
      })
    );
  }

  return {
    instanceOid: instance.oid,
    organizationOid: instance.organizationOid
  };
};
