import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, ID } from '@metorial/db';

class ResourceTenantServiceImpl {
  async upsertResourceTenant(d: {
    input: {
      name: string;
      identifier: string;
    };
  }) {
    try {
      return await db.resourceTenant.upsert({
        where: {
          identifier: d.input.identifier
        },
        update: {
          name: d.input.name
        },
        create: {
          id: await ID.generateId('resourceTenant'),
          name: d.input.name,
          identifier: d.input.identifier
        }
      });
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;

      let resourceTenant = await db.resourceTenant.findFirst({
        where: {
          identifier: d.input.identifier
        }
      });
      if (!resourceTenant) throw error;

      return resourceTenant;
    }
  }

  async getResourceTenantById(d: { id: string }) {
    let resourceTenant = await db.resourceTenant.findFirst({
      where: {
        OR: [{ id: d.id }, { identifier: d.id }]
      }
    });

    if (!resourceTenant) throw new ServiceError(notFoundError('resourceTenant', d.id));

    return resourceTenant;
  }
}

export let resourceTenantService = Service.create(
  'resourceTenantService',
  () => new ResourceTenantServiceImpl()
).build();
