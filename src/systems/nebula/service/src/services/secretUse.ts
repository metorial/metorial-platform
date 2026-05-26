import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Consumer, ConsumerInstance, Secret, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { ID, snowflake } from '../id';

class SecretUseServiceImpl {
  async recordSecretUse(d: {
    tenant: Tenant;
    secret: Secret;
    consumer: Consumer;
    consumerInstance: ConsumerInstance;
    note: string;
  }) {
    return await db.secretUse.create({
      data: {
        oid: snowflake.nextId(),
        id: await ID.generateId('secretUse'),
        tenantOid: d.tenant.oid,
        secretOid: d.secret.oid,
        consumerOid: d.consumer.oid,
        consumerInstanceOid: d.consumerInstance.oid,
        note: d.note
      }
    });
  }

  async listSecretUses(d: { tenant: Tenant; secret: Secret }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.secretUse.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            secretOid: d.secret.oid
          },
          orderBy: { ts: 'desc' }
        })
      )
    );
  }
}

export let secretUseService = Service.create(
  'secretUseService',
  () => new SecretUseServiceImpl()
).build();
