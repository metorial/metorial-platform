import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { getId } from '@metorial/cargo-config/id';
import { storeTemplateSyncSingleQueue } from '@metorial/cargo-module-store';
import { addAfterTransactionHook, db } from '@metorial/db';

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

    let { oid, id } = getId('resourceGroup');

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
        oid,
        id,
        resourceTenantOid: d.resourceTenant.oid,
        identifier: d.input.identifier,
        name: d.input.name,
        type: d.input.type
      },
      include
    });

    await addAfterTransactionHook(async () => {
      let storeTemplates = await db.storeTemplate.findMany({
        where: {
          type: 'standalone',
          resourceGroupOid: null,
          OR: [
            {
              resourceTenantOid: null
            },
            {
              resourceTenantOid: d.resourceTenant.oid
            }
          ]
        },
        select: {
          id: true
        }
      });

      if (storeTemplates.length === 0) return;

      await storeTemplateSyncSingleQueue.addMany(
        storeTemplates.map(storeTemplate => ({
          storeTemplateId: storeTemplate.id,
          resourceTenantId: resourceGroup.resourceTenant.id,
          resourceGroupId: resourceGroup.id,
          forceFullReconcile: true
        }))
      );
    });

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
  'cargoResourceGroupService',
  () => new ResourceGroupServiceImpl()
).build();
