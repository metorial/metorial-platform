import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, type EnvironmentType, getId, type Tenant } from '@metorial-subspace/db';

let include = {};

class environmentServiceImpl {
  async upsertEnvironment(d: {
    tenant: Tenant;
    input: {
      name: string;
      identifier: string;
      type: EnvironmentType;
    };
  }) {
    try {
      return await db.environment.upsert({
        where: { identifier: d.input.identifier },
        update: { name: d.input.name },
        create: {
          ...getId('environment'),
          name: d.input.name,
          identifier: d.input.identifier,
          type: d.input.type,
          tenantOid: d.tenant.oid
        },
        include
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return await db.environment.findFirstOrThrow({
          where: {
            tenantOid: d.tenant.oid,
            identifier: d.input.identifier
          },
          include
        });
      }

      throw error;
    }
  }

  async getEnvironmentById(d: { tenant: Tenant; id: string }) {
    let environment = await db.environment.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        OR: [{ id: d.id }, { identifier: d.id }]
      },
      include
    });
    if (!environment) throw new ServiceError(notFoundError('environment'));
    return environment;
  }
}

export let environmentService = Service.create(
  'environmentService',
  () => new environmentServiceImpl()
).build();
