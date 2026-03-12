import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  getEffectiveConsumerGroups,
  getSsoGroupIdsForSession,
  type EffectiveConsumerGroup
} from '@metorial/consumer-auth';
import { ConsumerGroup, ConsumerProfile, ConsumerSurface, db } from '@metorial/db';

let include = {
  consumer: true,
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

    let defaultGroups = await db.consumerGroup.findMany({
      where: {
        surfaceOid: d.consumerSurface.oid,
        status: 'active',
        isDefault: true
      }
    });

    let defaultGroupIds = new Set(defaultGroups.map(group => group.oid));
    let toAssignedGroup = (
      group: ConsumerGroup,
      assignedVia: EffectiveConsumerGroup['assignedVia']
    ): EffectiveConsumerGroup => ({
      ...group,
      assignedVia
    });
    let getDefaultAssignedGroups = () =>
      defaultGroups.map(group => toAssignedGroup(group, 'default'));
    let getManualAssignedGroups = (consumerProfile: (typeof d.consumerProfiles)[number]) => {
      let manualGroups: EffectiveConsumerGroup[] = [];

      for (let { group } of consumerProfile.groups) {
        if (
          group.oid == consumerProfile.personalConsumerGroupOid ||
          defaultGroupIds.has(group.oid)
        ) {
          continue;
        }

        manualGroups.push(toAssignedGroup(group, 'manual'));
      }

      return manualGroups;
    };
    let groupsByProfile: Record<string, EffectiveConsumerGroup[]> = {};

    for (let consumerProfile of d.consumerProfiles) {
      groupsByProfile[consumerProfile.id] = [
        toAssignedGroup(consumerProfile.personalConsumerGroup, 'user'),
        ...getDefaultAssignedGroups(),
        ...getManualAssignedGroups(consumerProfile)
      ];
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

  async getGroupsForProfile(d: {
    consumerProfile: ConsumerProfile;
    ssoGroupIds?: string[];
  }) {
    let ssoGroupIds = d.ssoGroupIds;

    if (ssoGroupIds === undefined) {
      let latestSession = await db.consumerSession.findFirst({
        where: {
          consumerProfileOid: d.consumerProfile.oid,
          revokedAt: null,
          expiresAt: {
            gt: new Date()
          },
          aresSessionId: {
            not: null
          }
        },
        orderBy: {
          lastUsedAt: 'desc'
        },
        include: {
          consumerProfile: {
            include: {
              surface: true
            }
          }
        }
      });

      ssoGroupIds =
        latestSession?.aresSessionId && latestSession.consumerProfile.surface.aresAppId
          ? await getSsoGroupIdsForSession({
              sessionId: latestSession.aresSessionId,
              preferredAresUserId: d.consumerProfile.aresUserId ?? undefined,
              preferredEmail: d.consumerProfile.email,
              appId: latestSession.consumerProfile.surface.aresAppId
            })
          : [];
    }

    return await getEffectiveConsumerGroups({
      consumerProfile: d.consumerProfile,
      ssoGroupIds
    });
  }
}

export let consumerProfileService = Service.create(
  'consumerProfileService',
  () => new ConsumerProfileServiceImpl()
).build();
