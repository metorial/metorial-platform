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
  InstanceConsumer,
  withTransaction
} from '@metorial/db';

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

  async ensureConsumerProfile(d: {
    surface: ConsumerSurface;
    aresUserId: string;
    email: string;
    name: string;
    ssoGroupIds?: string[];
    ssoRoles?: string[];
  }) {
    return await withTransaction(async tx => {
      let ssoGroupIds = normalizeStringList(d.ssoGroupIds);
      let ssoRoles = normalizeStringList(d.ssoRoles);
      let consumer = await tx.consumer.upsert({
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
          organizationOid: d.surface.organizationOid
        },
        update: {
          email: d.email,
          name: d.name
        }
      });

      await tx.instanceConsumer.upsert({
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
          consumerOid: consumer.oid
        },
        update: {
          name: d.name,
          email: d.email
        }
      });

      let existingProfile = await tx.consumerProfile.findUnique({
        where: {
          surfaceOid_aresUserId: {
            surfaceOid: d.surface.oid,
            aresUserId: d.aresUserId
          }
        }
      });
      if (existingProfile) {
        return await tx.consumerProfile.update({
          where: {
            oid: existingProfile.oid
          },
          data: {
            aresUserId: d.aresUserId,
            email: d.email,
            name: d.name,
            consumerOid: consumer.oid,
            ssoGroupIds,
            ssoRoles
          }
        });
      }

      let accessTag = await tx.accessTag.create({
        data: {
          instanceOid: d.surface.instanceOid
        }
      });

      let personalConsumerGroup = await tx.consumerGroup.create({
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

      return await tx.consumerProfile.create({
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
          accessTagOid: accessTag.oid,
          personalConsumerGroupOid: personalConsumerGroup.oid
        }
      });
    });
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
