import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { ID, snowflake } from '../id';

class ConsumerServiceImpl {
  async upsertConsumer(d: {
    tenant: Tenant;
    input: {
      name: string;
      identifier: string;
    };
  }) {
    return await db.consumer.upsert({
      where: {
        tenantOid_identifier: {
          tenantOid: d.tenant.oid,
          identifier: d.input.identifier
        }
      },
      update: {
        name: d.input.name,
        status: 'active'
      },
      create: {
        oid: snowflake.nextId(),
        id: await ID.generateId('consumer'),
        tenantOid: d.tenant.oid,
        name: d.input.name,
        identifier: d.input.identifier,
        status: 'active'
      }
    });
  }

  async getConsumerById(d: { tenant: Tenant; id: string }) {
    let consumer = await db.consumer.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        OR: [{ id: d.id }, { identifier: d.id }]
      }
    });
    if (!consumer) throw new ServiceError(notFoundError('consumer'));
    return consumer;
  }

  async listConsumers(d: { tenant: Tenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.consumer.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid
          },
          orderBy: { createdAt: 'desc' }
        })
      )
    );
  }
}

export let consumerService = Service.create(
  'consumerService',
  () => new ConsumerServiceImpl()
).build();
