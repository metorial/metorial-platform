import {
  ConsumerProfile,
  ConsumerProfileSsoUser,
  ConsumerSurface,
  db,
  SsoUser
} from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Service } from '@metorial/service';
import { Paginator } from '../../../../../packages/server/pagination/src';

let include = {
  consumer: true,
  groups: {
    include: {
      group: true
    }
  },
  ssoUsers: {
    include: {
      ssoUser: true
    }
  }
};

class consumerProfileServiceImpl {
  async getConsumerProfileById(d: {
    consumerSurface: ConsumerSurface;
    consumerProfileId: string;
  }) {
    let consumerProfile = await db.consumerProfile.findFirst({
      where: { id: d.consumerProfileId, surfaceOid: d.consumerSurface.oid },
      include
    });
    if (!consumerProfile) throw new ServiceError(notFoundError('consumer.profile'));
    return consumerProfile;
  }

  async listConsumerProfiles(d: { consumerSurface: ConsumerSurface }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.consumerProfile.findMany({
            ...opts,
            where: { surfaceOid: d.consumerSurface.oid },
            include
          })
      )
    );
  }

  async assignToGroups<T extends ConsumerProfile>(d: {
    consumerProfile: T;
    groupIds: string[];
  }) {
    let groups = await db.consumerGroup.findMany({
      where: {
        id: { in: d.groupIds },
        surfaceOid: d.consumerProfile.surfaceOid
      }
    });

    await db.consumerProfileGroup.createMany({
      data: groups.map(g => ({
        profileOid: d.consumerProfile.oid,
        groupOid: g.oid
      })),
      skipDuplicates: true
    });

    return d.consumerProfile;
  }

  async removeFromGroups<T extends ConsumerProfile>(d: {
    consumerProfile: T;
    groupIds: string[];
  }) {
    let groups = await db.consumerGroup.findMany({
      where: {
        id: { in: d.groupIds },
        surfaceOid: d.consumerProfile.surfaceOid
      }
    });

    await db.consumerProfileGroup.deleteMany({
      where: {
        profileOid: d.consumerProfile.oid,
        groupOid: { in: groups.map(g => g.oid) }
      }
    });

    return d.consumerProfile;
  }

  async getGroupsForProfile(d: {
    consumerProfile: ConsumerProfile & {
      ssoUsers: (ConsumerProfileSsoUser & {
        ssoUser: SsoUser;
      })[];
    };
  }) {
    let ssoGroupIds = d.consumerProfile.ssoUsers.flatMap(u => u.ssoUser.allGroups);

    let groups = await db.consumerGroup.findMany({
      where: {
        surfaceOid: d.consumerProfile.surfaceOid,

        OR: [
          // Default
          { isDefault: true },

          // Manual assignment
          { profiles: { some: { profileOid: d.consumerProfile.oid } } },

          // SSO Group membership
          ssoGroupIds.length
            ? {
                ssoGroupIds: { hasSome: ssoGroupIds }
              }
            : undefined!
        ].filter(Boolean)
      },
      include: {
        profiles: {
          where: {
            profileOid: d.consumerProfile.oid
          }
        }
      }
    });

    return groups.map(g => {
      if (g.isDefault) {
        return {
          ...g,
          assignedVia: 'default' as const
        };
      }

      if (ssoGroupIds.some(id => g.ssoGroupIds.includes(id))) {
        return {
          ...g,
          assignedVia: 'sso' as const
        };
      }

      return {
        ...g,
        assignedVia: 'manual' as const
      };
    });
  }
}

export let consumerProfileService = Service.create(
  'consumerProfileService',
  () => new consumerProfileServiceImpl()
).build();
