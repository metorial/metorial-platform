import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Function, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { ID, snowflake } from '../id';

let include = {
  currentVersion: true
};

class functionServiceImpl {
  async upsertFunction(d: {
    input: {
      name: string;
      identifier: string;
    };
    tenant: Tenant;
  }) {
    return await db.function.upsert({
      where: {
        identifier_tenantOid: {
          identifier: d.input.identifier,
          tenantOid: d.tenant.oid
        },
        status: 'active'
      },
      update: { name: d.input.name },
      create: {
        oid: snowflake.nextId(),
        id: await ID.generateId('function'),
        name: d.input.name,
        identifier: d.input.identifier,
        tenantOid: d.tenant.oid,
        status: 'active'
      },
      include
    });
  }

  async getFunctionById(d: { id: string; tenant: Tenant }) {
    let func = await db.function.findFirst({
      where: {
        OR: [{ id: d.id }, { identifier: d.id }],
        tenantOid: d.tenant.oid,
        status: 'active'
      },
      include
    });
    if (!func) throw new ServiceError(notFoundError('function'));
    return func;
  }

  async listFunctions(d: { tenant: Tenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.function.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              status: 'active'
            },
            include
          })
      )
    );
  }

  async updateFunction(d: {
    function: Function;
    input: {
      name?: string;
    };
  }) {
    return await db.function.update({
      where: { oid: d.function.oid },
      data: {
        name: d.input.name ?? d.function.name
      },
      include
    });
  }
}

export let functionService = Service.create(
  'functionService',
  () => new functionServiceImpl()
).build();
