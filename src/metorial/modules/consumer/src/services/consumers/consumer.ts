import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  Consumer,
  ConsumerProfile,
  ConsumerProfileInviteStatus,
  ConsumerSurface,
  db,
  ID,
  Instance,
  InstanceConsumer,
  Organization,
  OrganizationMember,
  TransactionDB,
  withTransaction
} from '@metorial/db';
import { createLock } from '@metorial/lock';
import { searchConsumerIds } from '@metorial/module-search';
import { consumerCreatedQueue, consumerUpdatedQueue } from '../../queues/lifecycle/consumer';

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

let normalizeEmailFilter = (emails?: string[]) => {
  let normalizedEmails = (emails ?? [])
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);

  if (!normalizedEmails.length) return undefined;

  return Array.from(new Set(normalizedEmails));
};

let syncConsumerProfileIdentity = async (d: {
  db: TransactionDB;
  instanceOid: bigint;
  consumerOid: bigint;
  name: string;
  email: string;
}) => {
  let profiles = await d.db.consumerProfile.findMany({
    where: {
      instanceOid: d.instanceOid,
      consumerOid: d.consumerOid,
      status: 'active'
    },
    select: { oid: true, surfaceOid: true },
    orderBy: [{ createdAt: 'asc' }, { oid: 'asc' }]
  });

  if (!profiles.length) return;

  await d.db.consumerProfile.updateMany({
    where: { oid: { in: profiles.map(profile => profile.oid) } },
    data: { name: d.name }
  });

  let surfaceOids = Array.from(new Set(profiles.map(profile => profile.surfaceOid)));
  let existingEmailProfiles = await d.db.consumerProfile.findMany({
    where: {
      surfaceOid: { in: surfaceOids },
      email: d.email
    },
    select: { surfaceOid: true }
  });
  let surfacesWithEmail = new Set(existingEmailProfiles.map(profile => profile.surfaceOid));

  for (let surfaceOid of surfaceOids) {
    if (surfacesWithEmail.has(surfaceOid)) continue;

    let profile = profiles.find(profile => profile.surfaceOid === surfaceOid);
    if (!profile) continue;

    await d.db.consumerProfile.update({
      where: { oid: profile.oid },
      data: { email: d.email }
    });
  }
};

type InstanceConsumerWithRelations = InstanceConsumer & {
  consumer: ConsumerWithRelations;
};

let getInclude = (d: { instanceOid: bigint }) => ({
  consumer: {
    include: {
      user: true,
      organizationMember: true,
      profiles: {
        where: {
          instanceOid: d.instanceOid,
          status: 'active' as const
        },
        include: {
          surface: true
        }
      }
    }
  }
});

class ConsumerServiceImpl {
  private hasRequiredFlags(d: {
    consumer: InstanceConsumerWithRelations;
    flags?: {
      isOrganizationMember?: boolean;
      isPortalConsumer?: boolean;
      isManuallyCreated?: boolean;
    };
  }) {
    return (
      (!d.flags?.isOrganizationMember || d.consumer.consumer.isOrganizationMember) &&
      (!d.flags?.isPortalConsumer || d.consumer.consumer.isPortalConsumer) &&
      (!d.flags?.isManuallyCreated || d.consumer.consumer.isManuallyCreated)
    );
  }

  async getConsumerById(d: { instance: Instance; consumerId: string }) {
    let consumer = await db.instanceConsumer.findFirst({
      where: {
        instanceOid: d.instance.oid,
        OR: [{ id: d.consumerId }, { consumer: { id: d.consumerId } }]
      },
      include: getInclude({ instanceOid: d.instance.oid })
    });
    if (!consumer) {
      throw new ServiceError(notFoundError('consumer'));
    }

    return consumer;
  }

  async listConsumers(d: {
    instance: Instance;
    search?: string;
    emails?: string[];
    id?: string;
  }) {
    let search = d.search?.trim();
    let emails = normalizeEmailFilter(d.emails);
    let id = d.id?.trim();
    let searchedConsumerIds = search
      ? await searchConsumerIds({
          instanceId: d.instance.id,
          query: search
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.instanceConsumer.findMany({
          ...opts,
          where: {
            AND: [
              {
                OR: [
                  {
                    consumer: { organizationMember: null }
                  },
                  {
                    consumer: {
                      organizationMember: {
                        actor: { type: 'member' }
                      }
                    }
                  }
                ]
              },
              {
                instanceOid: d.instance.oid,
                isPending: false
              },
              ...(search ? [{ id: { in: searchedConsumerIds ?? [] } }] : []),
              ...(emails?.length ? [{ email: { in: emails } }] : []),
              ...(id ? [{ OR: [{ id }, { consumer: { id } }] }] : [])
            ]
          },
          include: getInclude({ instanceOid: d.instance.oid })
        });
      })
    );
  }

  async findConsumersById(d: { instance: Instance; consumerIds: string[] }) {
    if (!d.consumerIds.length) {
      return [];
    }

    return await db.instanceConsumer.findMany({
      where: {
        instanceOid: d.instance.oid,
        OR: [
          {
            id: {
              in: d.consumerIds
            }
          },
          {
            consumer: {
              id: {
                in: d.consumerIds
              }
            }
          }
        ]
      },
      include: getInclude({ instanceOid: d.instance.oid })
    });
  }

  async createConsumer(d: {
    organization: Organization;
    instance: Instance;
    member?: OrganizationMember;
    flags?: {
      isOrganizationMember?: boolean;
      isPortalConsumer?: boolean;
      isManuallyCreated?: boolean;
    };
    input: {
      name: string;
      email: string;
    };
  }) {
    let instanceConsumer = await withTransaction(async db => {
      let consumer = await db.consumer.upsert({
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
          organizationOid: d.organization.oid,

          organizationMemberOid: d.member?.oid,
          organizationActorOid: d.member?.actorOid,

          isOrganizationMember: !!d.member || !!d.flags?.isOrganizationMember,
          isPortalConsumer: !!d.flags?.isPortalConsumer,
          isManuallyCreated: !!d.flags?.isManuallyCreated
        },
        update: {
          name: d.input.name,
          email: d.input.email,

          organizationMemberOid: d.member?.oid,
          organizationActorOid: d.member?.actorOid,

          isOrganizationMember: !!d.member || d.flags?.isOrganizationMember ? true : undefined,
          isPortalConsumer: d.flags?.isPortalConsumer ? true : undefined,
          isManuallyCreated: d.flags?.isManuallyCreated ? true : undefined
        }
      });

      let instanceConsumer = await db.instanceConsumer.upsert({
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
          consumerOid: consumer.oid,

          organizationMemberOid: consumer.organizationMemberOid,
          organizationActorOid: consumer.organizationActorOid
        },
        update: {
          name: d.input.name,
          email: d.input.email,

          organizationMemberOid: consumer.organizationMemberOid,
          organizationActorOid: consumer.organizationActorOid
        },
        include: getInclude({ instanceOid: d.instance.oid })
      });

      await syncConsumerProfileIdentity({
        db,
        instanceOid: d.instance.oid,
        consumerOid: consumer.oid,
        name: d.input.name,
        email: d.input.email
      });

      return instanceConsumer;
    });

    await consumerCreatedQueue.add({ instanceConsumerId: instanceConsumer.id });

    return instanceConsumer;
  }

  async updateConsumer(d: {
    consumer: InstanceConsumer;
    member?: OrganizationMember;
    flags?: {
      isOrganizationMember?: boolean;
      isPortalConsumer?: boolean;
      isManuallyCreated?: boolean;
    };
    input: {
      name?: string;
      email?: string;
    };
  }) {
    let consumer = await withTransaction(async db => {
      let name = d.input.name ?? d.consumer.name;
      let email = d.input.email ?? d.consumer.email;

      await db.consumer.update({
        where: {
          oid: d.consumer.consumerOid
        },
        data: {
          name,
          email,

          organizationMemberOid: d.member?.oid,
          organizationActorOid: d.member?.actorOid,

          isOrganizationMember:
            !!d.member || !!d.consumer.organizationMemberOid || d.flags?.isOrganizationMember
              ? true
              : undefined,
          isPortalConsumer: d.flags?.isPortalConsumer ? true : undefined,
          isManuallyCreated: d.flags?.isManuallyCreated ? true : undefined
        }
      });

      let consumer = await db.instanceConsumer.update({
        where: {
          oid: d.consumer.oid
        },
        data: {
          name,
          email,

          organizationMemberOid: d.member?.oid,
          organizationActorOid: d.member?.actorOid
        },
        include: getInclude({ instanceOid: d.consumer.instanceOid })
      });

      await syncConsumerProfileIdentity({
        db,
        instanceOid: d.consumer.instanceOid,
        consumerOid: d.consumer.consumerOid,
        name,
        email
      });

      return consumer;
    });

    await consumerUpdatedQueue.add({ instanceConsumerId: consumer.id });

    return consumer;
  }

  async upsertConsumer(d: {
    organization: Organization;
    instance: Instance;
    member?: OrganizationMember;
    flags?: {
      isOrganizationMember?: boolean;
      isPortalConsumer?: boolean;
      isManuallyCreated?: boolean;
    };
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
      if (
        existing.name === d.input.name &&
        existing.organizationMemberOid == d.member?.oid &&
        this.hasRequiredFlags({
          consumer: existing as InstanceConsumerWithRelations,
          flags: d.flags
        })
      ) {
        return existing;
      }

      return await this.updateConsumer({
        consumer: existing as InstanceConsumerWithRelations,
        member: d.member,
        flags: d.flags,
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
        if (
          existing.name === d.input.name &&
          existing.organizationMemberOid == d.member?.oid &&
          this.hasRequiredFlags({
            consumer: existing as InstanceConsumerWithRelations,
            flags: d.flags
          })
        ) {
          return existing;
        }

        return await this.updateConsumer({
          consumer: existing as InstanceConsumerWithRelations,
          member: d.member,
          flags: d.flags,
          input: {
            name: d.input.name,
            email: d.input.email
          }
        });
      }

      return await this.createConsumer({
        organization: d.organization,
        instance: d.instance,
        member: d.member,
        flags: d.flags,
        input: {
          name: d.input.name,
          email: d.input.email
        }
      });
    });
  }

  async syncPendingStatus(d: { consumer: Consumer; instance: Instance }) {
    let activeInviteStatuses: ConsumerProfileInviteStatus[] = ['unset', 'accepted'];
    let hasActiveProfiles = await db.consumerProfile.count({
      where: {
        consumerOid: d.consumer.oid,
        status: 'active',
        inviteStatus: {
          in: activeInviteStatuses
        }
      }
    });
    let hasActiveInstanceProfiles = await db.consumerProfile.count({
      where: {
        consumerOid: d.consumer.oid,
        instanceOid: d.instance.oid,
        status: 'active',
        inviteStatus: {
          in: activeInviteStatuses
        }
      }
    });
    let isConsumerPending = hasActiveProfiles === 0;
    let isInstancePending = hasActiveInstanceProfiles === 0;

    if (d.consumer.isOrganizationMember || d.consumer.isManuallyCreated) {
      isConsumerPending = false;
      isInstancePending = false;
    }

    await withTransaction(async tx => {
      await tx.consumer.updateMany({
        where: {
          oid: d.consumer.oid
        },
        data: { isPending: isConsumerPending }
      });
      await tx.instanceConsumer.updateMany({
        where: {
          consumerOid: d.consumer.oid,
          instanceOid: d.instance.oid
        },
        data: { isPending: isInstancePending }
      });
    });

    return {
      isConsumerPending,
      isInstancePending
    };
  }
}

export let consumerService = Service.create(
  'consumerService',
  () => new ConsumerServiceImpl()
).build();
