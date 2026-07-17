import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { addAfterTransactionHook, db, ID } from '@metorial/db';
import { Fabric } from '@metorial/fabric';

let include = {
  resourceTenant: true
};

class ResourceGroupServiceImpl {
  async upsertResourceGroup(d: {
    resourceTenant: { oid: bigint };
    input: {
      identifier: string;
      name: string;
      type: 'development' | 'production';
    };
  }) {
    let existing = await db.resourceGroup.findFirst({
      where: {
        resourceTenantOid: d.resourceTenant.oid,
        identifier: d.input.identifier
      },
      include
    });

    if (existing) {
      return await db.resourceGroup.update({
        where: {
          id: existing.id
        },
        data: {
          name: d.input.name,
          type: d.input.type
        },
        include
      });
    }

    let resourceGroup = await db.resourceGroup.upsert({
      where: {
        resourceTenantOid_identifier: {
          resourceTenantOid: d.resourceTenant.oid,
          identifier: d.input.identifier
        }
      },
      update: {
        name: d.input.name,
        type: d.input.type
      },
      create: {
        id: await ID.generateId('resourceGroup'),
        resourceTenantOid: d.resourceTenant.oid,
        identifier: d.input.identifier,
        name: d.input.name,
        type: d.input.type
      },
      include
    });

    await addAfterTransactionHook(() =>
      Fabric.fire('resource_tenant.resource_group.created:after', {
        resourceTenant: resourceGroup.resourceTenant,
        resourceGroup
      })
    );

    return resourceGroup;
  }

  async getResourceGroupById(d: { resourceTenant: { oid: bigint }; id: string }) {
    let resourceGroup = await db.resourceGroup.findFirst({
      where: {
        resourceTenantOid: d.resourceTenant.oid,
        OR: [{ id: d.id }, { identifier: d.id }]
      },
      include
    });

    if (!resourceGroup) throw new ServiceError(notFoundError('resourceGroup', d.id));

    return resourceGroup;
  }

  async listResourceGroups(d: { resourceTenant: { oid: bigint } }) {
    return await db.resourceGroup.findMany({
      where: {
        resourceTenantOid: d.resourceTenant.oid
      },
      orderBy: {
        createdAt: 'asc'
      },
      include
    });
  }
}

export let resourceGroupService = Service.create(
  'resourceGroupService',
  () => new ResourceGroupServiceImpl()
).build();
