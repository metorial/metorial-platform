import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { storeTemplateSyncSingleQueue } from '../queues/storeTemplateSync';

Fabric.listen(
  'resource_tenant.resource_group.created:after',
  async ({ resourceTenant, resourceGroup }) => {
    let storeTemplates = await db.storeTemplate.findMany({
      where: {
        type: 'standalone',
        resourceGroupOid: null,
        OR: [
          {
            resourceTenantOid: null
          },
          {
            resourceTenantOid: resourceTenant.oid
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
        resourceTenantId: resourceTenant.id,
        resourceGroupId: resourceGroup.id,
        forceFullReconcile: true
      }))
    );
  }
);
