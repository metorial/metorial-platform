import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  Consumer,
  db,
  ID,
  Instance,
  InstanceConsumer,
  Organization,
  withTransaction
} from '@metorial/db';

let include = {
  consumer: true
} as const;

class ConsumerServiceImpl {
  async getConsumerById(d: { instance: Instance; consumerId: string }) {
    let consumer = await db.instanceConsumer.findFirst({
      where: {
        instanceOid: d.instance.oid,
        id: d.consumerId
      },
      include
    });
    if (!consumer) {
      throw new ServiceError(notFoundError('consumer'));
    }

    return consumer;
  }

  async listConsumers(d: { instance: Instance }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.instanceConsumer.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid
          },
          include
        });
      })
    );
  }

  async createConsumer(d: {
    organization: Organization;
    instance: Instance;
    input: {
      name: string;
      email: string;
    };
  }) {
    return await withTransaction(async tx => {
      let consumer = await tx.consumer.upsert({
        where: {
          email_organizationOid: {
            email: d.input.email,
            organizationOid: d.organization.oid
          }
        },
        create: {
          id: await ID.generateId('consumer'),
          name: d.input.name,
          email: d.input.email,
          organizationOid: d.organization.oid
        },
        update: {
          name: d.input.name,
          email: d.input.email
        }
      });

      let instanceConsumer = await tx.instanceConsumer.upsert({
        where: {
          instanceOid_consumerOid: {
            instanceOid: d.instance.oid,
            consumerOid: consumer.oid
          }
        },
        create: {
          id: await ID.generateId('instanceConsumer'),
          name: d.input.name,
          email: d.input.email,
          instanceOid: d.instance.oid,
          consumerOid: consumer.oid
        },
        update: {
          name: d.input.name,
          email: d.input.email
        },
        include
      });

      await tx.consumerProfile.updateMany({
        where: {
          instanceOid: d.instance.oid,
          consumerOid: consumer.oid
        },
        data: {
          name: d.input.name,
          email: d.input.email
        }
      });

      return instanceConsumer;
    });
  }

  async updateConsumer(d: {
    consumer: InstanceConsumer & {
      consumer: Consumer;
    };
    input: {
      name?: string;
      email?: string;
    };
  }) {
    return await withTransaction(async tx => {
      let name = d.input.name ?? d.consumer.name;
      let email = d.input.email ?? d.consumer.email;

      await tx.consumer.update({
        where: {
          oid: d.consumer.consumerOid
        },
        data: {
          name,
          email
        }
      });

      let consumer = await tx.instanceConsumer.update({
        where: {
          oid: d.consumer.oid
        },
        data: {
          name,
          email
        },
        include
      });

      await tx.consumerProfile.updateMany({
        where: {
          instanceOid: d.consumer.instanceOid,
          consumerOid: d.consumer.consumerOid
        },
        data: {
          name,
          email
        }
      });

      return consumer;
    });
  }
}

export let consumerService = Service.create(
  'consumerService',
  () => new ConsumerServiceImpl()
).build();
