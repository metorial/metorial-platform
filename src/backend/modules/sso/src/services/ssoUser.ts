import { db, Instance } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Service } from '@metorial/service';
import { Paginator } from '../../../../../packages/server/pagination/src';

let include = {
  ssoTenant: true,
  profiles: true
};

class ssoUserServiceImpl {
  async listSsoUsers(d: {
    instance: Instance;
    profile_ids?: string[];
    consumer_profile_ids?: string[];
  }) {
    let profiles = d.profile_ids
      ? await db.ssoUserProfile.findMany({
          where: {
            id: { in: d.profile_ids }
          }
        })
      : undefined;
    let consumerProfiles = d.consumer_profile_ids
      ? await db.consumerProfile.findMany({
          where: {
            id: { in: d.consumer_profile_ids }
          }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.ssoUser.findMany({
            ...opts,
            where: {
              ssoTenant: {
                organizationOid: d.instance.organizationOid
              },

              AND: [
                profiles
                  ? {
                      profiles: {
                        some: {
                          oid: { in: profiles.map(p => p.oid) }
                        }
                      }
                    }
                  : undefined!,

                consumerProfiles
                  ? {
                      consumerProfileSsoUsers: {
                        some: {
                          consumerProfileOid: { in: consumerProfiles.map(cp => cp.oid) }
                        }
                      }
                    }
                  : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getSsoUserById(d: { ssoUserId: string; instance: Instance }) {
    let user = await db.ssoUser.findUnique({
      where: {
        id: d.ssoUserId,

        ssoTenant: {
          organizationOid: d.instance.organizationOid
        }
      },
      include
    });
    if (!user) throw new ServiceError(notFoundError('sso.user'));
    return user;
  }

  async DANGEROUSLY_getSsoUserById(d: { ssoUserId: string }) {
    let user = await db.ssoUser.findUnique({
      where: {
        id: d.ssoUserId
      },
      include
    });
    if (!user) throw new ServiceError(notFoundError('sso.user'));
    return user;
  }
}

export let ssoUserService = Service.create(
  'ssoUserService',
  () => new ssoUserServiceImpl()
).build();
