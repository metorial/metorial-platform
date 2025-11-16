import { db, Organization } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Service } from '@metorial/service';
import { Paginator } from '../../../../../packages/server/pagination/src';

let include = {
  profiles: true
};

class consumerServiceImpl {
  async getConsumerById(d: { organization: Organization; consumerId: string }) {
    let consumer = await db.consumer.findFirst({
      where: { id: d.consumerId, organizationOid: d.organization.oid },
      include
    });
    if (!consumer) throw new ServiceError(notFoundError('consumer.surface'));
    return consumer;
  }

  async listConsumers(d: { organization: Organization }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.consumer.findMany({
            ...opts,
            where: { organizationOid: d.organization.oid },
            include
          })
      )
    );
  }
}

export let consumerService = Service.create(
  'consumerService',
  () => new consumerServiceImpl()
).build();
