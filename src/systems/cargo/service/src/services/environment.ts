import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db } from '../db';
import { getId } from '../id';

let include = {
  tenant: true
};

class EnvironmentServiceImpl {
  async upsertEnvironment(d: {
    tenant: { oid: bigint };
    input: {
      identifier: string;
      name: string;
      type: 'development' | 'production';
    };
  }) {
    let existing = await db.environment.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        identifier: d.input.identifier
      },
      include
    });

    if (existing) {
      return await db.environment.update({
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

    let { oid, id } = getId('environment');

    return await db.environment.create({
      data: {
        oid,
        id,
        tenantOid: d.tenant.oid,
        identifier: d.input.identifier,
        name: d.input.name,
        type: d.input.type
      },
      include
    });
  }

  async getEnvironmentById(d: {
    tenant: { oid: bigint };
    id: string;
  }) {
    let environment = await db.environment.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        OR: [{ id: d.id }, { identifier: d.id }]
      },
      include
    });

    if (!environment) throw new ServiceError(notFoundError('environment', d.id));

    return environment;
  }

  async listEnvironments(d: {
    tenant: { oid: bigint };
  }) {
    return await db.environment.findMany({
      where: {
        tenantOid: d.tenant.oid
      },
      orderBy: {
        createdAt: 'asc'
      },
      include
    });
  }
}

export let environmentService = Service.create(
  'cargoEnvironmentService',
  () => new EnvironmentServiceImpl()
).build();
