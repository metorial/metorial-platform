import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  getEffectiveConsumerGroups,
  normalizeStringList,
  type EffectiveConsumerGroup
} from '@metorial/consumer-auth';
import {
  ConsumerGroup,
  ConsumerProfile,
  ConsumerSurface,
  db,
  ID,
  Instance,
  InstanceConsumer,
  OrganizationMember,
  withTransaction
} from '@metorial/db';
import { createLock } from '@metorial/lock';
import { syncIdentityConsumerQueue } from '../queues/syncIdentityConsumer';

let include = {
  consumer: true,
  surface: true,
  personalConsumerGroup: true,
  groups: {
    include: {
      group: true
    }
  }
} as const;

export let ensureProfileLock = createLock({
  name: 'cons/ensureProfile'
});

class ConsumerProfileServiceImpl {
  private async getAssignableGroupsOrThrow(d: {
    consumerProfile: Pick<ConsumerProfile, 'surfaceOid'>;
    groupIds: string[];
  }) {
    let groupIds = Array.from(new Set(d.groupIds));
    if (!groupIds.length) {
      return [];
    }

    let groups = await db.consumerGroup.findMany({
      where: {
        id: { in: groupIds },
        surfaceOid: d.consumerProfile.surfaceOid,
        status: 'active',
        type: 'default'
      }
    });

    if (groups.length !== groupIds.length) {
      throw new ServiceError(notFoundError('consumer.group'));
    }

    return groups;
  }

  async getConsumerProfileById(d: {
    consumerSurface: ConsumerSurface;
    consumerProfileId: string;
  }) {
    let consumerProfile = await db.consumerProfile.findFirst({
      where: {
        surfaceOid: d.consumerSurface.oid,
        id: d.consumerProfileId
      },
      include
    });
    if (!consumerProfile) {
      throw new ServiceError(notFoundError('consumer.profile'));
    }

    return consumerProfile;
  }

  async listConsumerProfiles(d: { consumerSurface: ConsumerSurface }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.consumerProfile.findMany({
          ...opts,
          where: {
            surfaceOid: d.consumerSurface.oid
          },
          include
        });
      })
    );
  }

  async getConsumerProfileByIdForConsumer(d: {
    consumer: Pick<InstanceConsumer, 'instanceOid' | 'consumerOid'>;
    consumerProfileId: string;
  }) {
    let consumerProfile = await db.consumerProfile.findFirst({
      where: {
        instanceOid: d.consumer.instanceOid,
        consumerOid: d.consumer.consumerOid,
        id: d.consumerProfileId
      },
      include
    });
    if (!consumerProfile) {
      throw new ServiceError(notFoundError('consumer.profile'));
    }

    return consumerProfile;
  }

  async listConsumerProfilesForConsumer(d: {
    consumer: Pick<InstanceConsumer, 'instanceOid' | 'consumerOid'>;
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.consumerProfile.findMany({
          ...opts,
          where: {
            instanceOid: d.consumer.instanceOid,
            consumerOid: d.consumer.consumerOid
          },
          include
        });
      })
    );
  }

  async getConsumerProfileByIdForInstance(d: {
    instance: Instance;
    consumerProfileId: string;
  }) {
    let consumerProfile = await db.consumerProfile.findFirst({
      where: {
        instanceOid: d.instance.oid,
        id: d.consumerProfileId
      },
      include
    });
    if (!consumerProfile) {
      throw new ServiceError(notFoundError('consumer.profile'));
    }

    return consumerProfile;
  }

  async findConsumerProfilesByIdForInstance(d: {
    instance: Instance;
    consumerProfileIds: string[];
  }) {
    if (!d.consumerProfileIds.length) {
      return [];
    }

    return await db.consumerProfile.findMany({
      where: {
        instanceOid: d.instance.oid,
        id: {
          in: d.consumerProfileIds
        }
      },
      include
    });
  }

  async ensureConsumerProfile(d: {
    surface: ConsumerSurface;
    email: string;
    name: string;
    member?: Pick<OrganizationMember, 'oid' | 'actorOid'>;

    aresUserId?: string;
    ssoGroupIds?: string[];
    ssoRoles?: string[];
  }) {
    let res = await withTransaction(async db => {
      let ssoGroupIds = normalizeStringList(d.ssoGroupIds);
      let ssoRoles = normalizeStringList(d.ssoRoles);
      let existingConsumer = await db.consumer.findUnique({
        where: {
          email_organizationOid: {
            email: d.email,
            organizationOid: d.surface.organizationOid
          }
        },
        select: {
          isOrganizationMember: true,
          isPortalConsumer: true,
          organizationMemberOid: true,
          organizationActorOid: true
        }
      });
      let consumer = await db.consumer.upsert({
        where: {
          email_organizationOid: {
            email: d.email,
            organizationOid: d.surface.organizationOid
          }
        },
        create: {
          id: await ID.generateId('consumer'),
          email: d.email,
          name: d.name,
          organizationOid: d.surface.organizationOid,
          organizationMemberOid: d.member?.oid,
          organizationActorOid: d.member?.actorOid,
          isOrganizationMember: d.surface.type === 'organization_members',
          isPortalConsumer: d.surface.type === 'portal'
        },
        update: {
          email: d.email,
          name: d.name,
          organizationMemberOid: d.member?.oid ?? existingConsumer?.organizationMemberOid,
          organizationActorOid: d.member?.actorOid ?? existingConsumer?.organizationActorOid,
          isOrganizationMember:
            !!d.member ||
            !!existingConsumer?.isOrganizationMember ||
            d.surface.type === 'organization_members',
          isPortalConsumer: existingConsumer?.isPortalConsumer || d.surface.type === 'portal'
        }
      });

      await db.instanceConsumer.upsert({
        where: {
          instanceOid_consumerOid: {
            instanceOid: d.surface.instanceOid,
            consumerOid: consumer.oid
          }
        },
        create: {
          id: await ID.generateId('instanceConsumer'),
          name: d.name,
          email: d.email,
          instanceOid: d.surface.instanceOid,
          consumerOid: consumer.oid,
          organizationMemberOid: d.member?.oid,
          organizationActorOid: d.member?.actorOid
        },
        update: {
          name: d.name,
          email: d.email,
          organizationMemberOid: d.member?.oid ?? consumer.organizationMemberOid,
          organizationActorOid: d.member?.actorOid ?? consumer.organizationActorOid
        }
      });

      return ensureProfileLock.usingLock(`${d.surface.instanceOid}-${d.email}`, async () => {
        let existingProfile = await db.consumerProfile.findUnique({
          where: d.aresUserId
            ? {
                surfaceOid_aresUserId: { surfaceOid: d.surface.oid, aresUserId: d.aresUserId }
              }
            : { email_surfaceOid: { email: d.email, surfaceOid: d.surface.oid } }
        });
        if (existingProfile) {
          return {
            consumer,
            consumerProfile: await db.consumerProfile.update({
              where: {
                oid: existingProfile.oid
              },
              data: {
                aresUserId: d.aresUserId,
                email: d.email,
                name: d.name,
                consumerOid: consumer.oid,
                organizationMemberOid: d.member?.oid ?? consumer.organizationMemberOid,
                organizationActorOid: d.member?.actorOid ?? consumer.organizationActorOid,
                ssoGroupIds,
                ssoRoles
              },
              include
            })
          };
        }

        let accessTag = await db.accessTag.create({
          data: {
            instanceOid: d.surface.instanceOid
          }
        });

        let personalConsumerGroup = await db.consumerGroup.create({
          data: {
            id: await ID.generateId('consumerGroup'),
            status: 'active',
            type: 'user_access',
            isDefault: false,
            ssoGroupIds: [],
            name: `Personal Group for ${d.email}`,
            description: null,
            surfaceOid: d.surface.oid,
            accessTagOid: accessTag.oid
          }
        });

        return {
          consumer,
          consumerProfile: await db.consumerProfile.create({
            data: {
              id: await ID.generateId('consumerProfile'),
              aresUserId: d.aresUserId,
              email: d.email,
              name: d.name,
              ssoGroupIds,
              ssoRoles,
              organizationOid: d.surface.organizationOid,
              instanceOid: d.surface.instanceOid,
              surfaceOid: d.surface.oid,
              consumerOid: consumer.oid,
              organizationMemberOid: d.member?.oid ?? consumer.organizationMemberOid,
              organizationActorOid: d.member?.actorOid ?? consumer.organizationActorOid,
              accessTagOid: accessTag.oid,
              personalConsumerGroupOid: personalConsumerGroup.oid
            },
            include
          })
        };
      });
    });

    await syncIdentityConsumerQueue.add({
      identityConsumerId: res.consumer.id
    });

    return res.consumerProfile;
  }

  async getStoredGroupsForProfiles(d: {
    consumerSurface: ConsumerSurface;
    consumerProfiles: Array<
      ConsumerProfile & {
        personalConsumerGroup: ConsumerGroup;
        groups: Array<{ group: ConsumerGroup }>;
      }
    >;
  }) {
    if (!d.consumerProfiles.length) {
      return {} as Record<string, EffectiveConsumerGroup[]>;
    }

    let activeGroups = await db.consumerGroup.findMany({
      where: {
        surfaceOid: d.consumerSurface.oid,
        status: 'active'
      }
    });

    let toAssignedGroup = (
      group: ConsumerGroup,
      assignedVia: EffectiveConsumerGroup['assignedVia']
    ): EffectiveConsumerGroup => ({
      ...group,
      assignedVia
    });
    let groupsByProfile: Record<string, EffectiveConsumerGroup[]> = {};

    for (let consumerProfile of d.consumerProfiles) {
      let manualGroupIds = new Set(consumerProfile.groups.map(({ group }) => group.oid));
      let ssoGroupIds = new Set(consumerProfile.ssoGroupIds ?? []);

      groupsByProfile[consumerProfile.id] = activeGroups.flatMap(group => {
        if (group.oid == consumerProfile.personalConsumerGroupOid) {
          return [toAssignedGroup(group, 'user')];
        }

        if (group.isDefault) {
          return [toAssignedGroup(group, 'default')];
        }

        if (group.ssoGroupIds.some(ssoGroupId => ssoGroupIds.has(ssoGroupId))) {
          return [toAssignedGroup(group, 'sso')];
        }

        if (manualGroupIds.has(group.oid)) {
          return [toAssignedGroup(group, 'manual')];
        }

        return [];
      });
    }

    return groupsByProfile;
  }

  async assignToGroups<T extends ConsumerProfile>(d: {
    consumerProfile: T;
    groupIds: string[];
  }) {
    let groups = await this.getAssignableGroupsOrThrow(d);

    if (groups.length) {
      await db.consumerProfileGroup.createMany({
        data: groups.map(group => ({
          profileOid: d.consumerProfile.oid,
          groupOid: group.oid
        })),
        skipDuplicates: true
      });
    }

    return d.consumerProfile;
  }

  async removeFromGroups<T extends ConsumerProfile>(d: {
    consumerProfile: T;
    groupIds: string[];
  }) {
    let groups = await this.getAssignableGroupsOrThrow(d);

    await db.consumerProfileGroup.deleteMany({
      where: {
        profileOid: d.consumerProfile.oid,
        groupOid: { in: groups.map(group => group.oid) }
      }
    });

    return d.consumerProfile;
  }

  async getGroupsForProfile(d: { consumerProfile: ConsumerProfile; ssoGroupIds?: string[] }) {
    return await getEffectiveConsumerGroups({
      consumerProfile: d.consumerProfile,
      ssoGroupIds: d.ssoGroupIds ?? d.consumerProfile.ssoGroupIds ?? []
    });
  }
}

export let consumerProfileService = Service.create(
  'consumerProfileService',
  () => new ConsumerProfileServiceImpl()
).build();
