import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  getEffectiveConsumerGroups,
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

  async getGroupsForProfile(d: {
    consumerProfile: ConsumerProfile;
    ssoGroupIds?: string[];
  }) {
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
