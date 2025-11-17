import { ConsumerProfile, ConsumerSurface, db, SsoUser } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Service } from '@metorial/service';
import { Paginator } from '../../../../../packages/server/pagination/src';

let include = {
  consumer: true,
  ssoUser: true,
  groups: {
    include: {
      group: true
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

  async assignToGroups(d: { consumerProfile: ConsumerProfile; groupIds: string[] }) {
    let groups = await db.consumerGroup.findMany({
      where: {
        id: { in: d.groupIds },
        surfaceOid: d.consumerProfile.surfaceOid
      }
    });

    return await db.consumerProfile.update({
      where: { oid: d.consumerProfile.oid },
      data: {
        groups: {
          connect: groups.map(g => ({ oid: g.oid }))
        }
      },
      include
    });
  }

  async removeFromGroups(d: { consumerProfile: ConsumerProfile; groupIds: string[] }) {
    let groups = await db.consumerGroup.findMany({
      where: {
        id: { in: d.groupIds },
        surfaceOid: d.consumerProfile.surfaceOid
      }
    });

    return await db.consumerProfile.update({
      where: { oid: d.consumerProfile.oid },
      data: {
        groups: {
          disconnect: groups.map(g => ({ oid: g.oid }))
        }
      },
      include
    });
  }

  async getGroupsForProfile(d: {
    consumerProfile: ConsumerProfile & {
      ssoUser: SsoUser | null;
    };
  }) {
    return db.consumerGroup.findMany({
      where: {
        surfaceOid: d.consumerProfile.surfaceOid,

        OR: [
          // Default
          { isDefault: true },

          // Manual assignment
          { profiles: { some: { profileOid: d.consumerProfile.oid } } },

          // SSO Group membership
          d.consumerProfile.ssoUser
            ? {
                ssoGroupIds: { hasSome: d.consumerProfile.ssoUser.allGroups }
              }
            : undefined!
        ].filter(Boolean)
      }
    });
  }
}

export let consumerProfileService = Service.create(
  'consumerProfileService',
  () => new consumerProfileServiceImpl()
).build();
