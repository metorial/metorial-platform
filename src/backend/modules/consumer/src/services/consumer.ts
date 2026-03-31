import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  Consumer,
  ConsumerProfile,
  ConsumerSurface,
  db,
  ID,
  Instance,
  InstanceConsumer,
  Organization,
  OrganizationMember,
  withTransaction
} from '@metorial/db';
import { createLock } from '@metorial/lock';
import { syncIdentityConsumerQueue } from '../queues/syncIdentityConsumer';

type ConsumerWithRelations = Consumer & {
  organizationMember: OrganizationMember | null;
  profiles: Array<
    ConsumerProfile & {
      surface: ConsumerSurface;
    }
  >;
};

let upsertLock = createLock({
  name: 'cons/upsert'
});

type InstanceConsumerWithRelations = InstanceConsumer & {
  consumer: ConsumerWithRelations;
};

let getInclude = (d: { instanceOid: bigint }) => ({
  consumer: {
    include: {
      organizationMember: true,
      profiles: {
        where: {
          instanceOid: d.instanceOid
        },
        include: {
          surface: true
        }
      }
    }
  }
});

class ConsumerServiceImpl {
  async getConsumerById(d: { instance: Instance; consumerId: string }) {
    let consumer = await db.instanceConsumer.findFirst({
      where: {
        instanceOid: d.instance.oid,
        OR: [{ id: d.consumerId }, { consumer: { id: d.consumerId } }]
      },
      include: {
        consumer: {
          include: {
            organizationMember: true,
            profiles: {
              where: {
                instanceOid: d.instance.oid
              },
              include: {
                surface: true
              }
            }
          }
        }
      }
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
          include: {
            consumer: {
              include: {
                organizationMember: true,
                profiles: {
                  where: {
                    instanceOid: d.instance.oid
                  },
                  include: {
                    surface: true
                  }
                }
              }
            }
          }
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
    let instanceConsumer = await withTransaction(async tx => {
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
        include: getInclude({ instanceOid: d.instance.oid })
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

    await syncIdentityConsumerQueue.add({
      identityConsumerId: instanceConsumer.consumer.id
    });

    return instanceConsumer;
  }

  async updateConsumer(d: {
    consumer: InstanceConsumerWithRelations;
    input: {
      name?: string;
      email?: string;
    };
  }) {
    let consumer = await withTransaction(async tx => {
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
        include: getInclude({ instanceOid: d.consumer.instanceOid })
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

    await syncIdentityConsumerQueue.add({
      identityConsumerId: consumer.consumer.id
    });

    return consumer;
  }

  async upsertConsumer(d: {
    organization: Organization;
    instance: Instance;
    input: {
      name: string;
      email: string;
    };
  }) {
    let existing = await db.instanceConsumer.findFirst({
      where: {
        instanceOid: d.instance.oid,
        email: d.input.email
      },
      include: getInclude({ instanceOid: d.instance.oid })
    });
    if (existing) {
      if (existing.name === d.input.name) return existing;

      return await this.updateConsumer({
        consumer: existing as InstanceConsumerWithRelations,
        input: {
          name: d.input.name,
          email: d.input.email
        }
      });
    }

    return await upsertLock.usingLock(`${d.instance.oid}-${d.input.email}`, async () => {
      let existing = await db.instanceConsumer.findFirst({
        where: {
          instanceOid: d.instance.oid,
          email: d.input.email
        },
        include: getInclude({ instanceOid: d.instance.oid })
      });
      if (existing) {
        if (existing.name === d.input.name) return existing;

        return await this.updateConsumer({
          consumer: existing as InstanceConsumerWithRelations,
          input: {
            name: d.input.name,
            email: d.input.email
          }
        });
      }

      return await this.createConsumer(d);
    });
  }
}

export let consumerService = Service.create(
  'consumerService',
  () => new ConsumerServiceImpl()
).build();
