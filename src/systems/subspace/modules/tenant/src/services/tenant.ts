import { notFoundError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Service } from '@lowerdeck/service';
import { db, type EnvironmentType, getId } from '@metorial-subspace/db';

let include = {};

class tenantServiceImpl {
  async upsertTenant(d: {
    input: {
      name: string;
      identifier: string;
      environments: {
        name: string;
        identifier: string;
        type: EnvironmentType;
      }[];
    };
  }) {
    try {
      let tenant = await db.tenant.upsert({
        where: { identifier: d.input.identifier },
        update: {
          name: d.input.name
        },
        create: {
          ...getId('tenant'),
          name: d.input.name,
          identifier: d.input.identifier,

          urlKey: generatePlainId(10).toLowerCase()
        }
      });

      await db.environment.createMany({
        skipDuplicates: true,
        data: d.input.environments.map(env => ({
          ...getId('environment'),
          tenantOid: tenant.oid,
          name: env.name,
          identifier: env.identifier,
          type: env.type
        }))
      });

      return await db.tenant.findFirstOrThrow({
        where: { identifier: d.input.identifier },
        include
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        let tenant = await db.tenant.findFirst({
          where: { identifier: d.input.identifier },
          include
        });
        if (tenant) return tenant;
      }

      throw error;
    }
  }

  async getTenantById(d: { id: string }) {
    let tenant = await db.tenant.findFirst({
      where: { OR: [{ id: d.id }, { identifier: d.id }] },
      include
    });
    if (!tenant) throw new ServiceError(notFoundError('tenant'));
    return tenant;
  }

  async getTenantAndEnvironmentById(d: { tenantId: string; environmentId: string }) {
    let tenant = await db.tenant.findFirst({
      where: { OR: [{ id: d.tenantId }, { identifier: d.tenantId }] },
      include: {
        environments: {
          where: { OR: [{ id: d.environmentId }, { identifier: d.environmentId }] }
        }
      }
    });
    let environment = tenant?.environments[0];

    if (!tenant) throw new ServiceError(notFoundError('tenant'));
    if (!environment) throw new ServiceError(notFoundError('environment'));

    return {
      tenant,
      environment
    };
  }
}

export let tenantService = Service.create(
  'tenantService',
  () => new tenantServiceImpl()
).build();
