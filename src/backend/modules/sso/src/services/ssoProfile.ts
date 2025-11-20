import { db, Instance } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Service } from '@metorial/service';
import { Paginator } from '../../../../../packages/server/pagination/src';

let include = {
  ssoUser: {
    include: {
      ssoTenant: true
    }
  }
};

class ssoProfileServiceImpl {
  async listSsoProfiles(d: {
    instance: Instance;
    user_ids?: string[];
    consumer_profile_ids?: string[];
  }) {
    let users = d.user_ids
      ? await db.ssoUser.findMany({
          where: {
            id: { in: d.user_ids }
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
          await db.ssoUserProfile.findMany({
            ...opts,
            where: {
              ssoUser: {
                ssoTenant: {
                  organizationOid: d.instance.organizationOid
                },

                AND: [
                  users
                    ? {
                        ssoUserOid: { in: users.map(u => u.oid) }
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
              }
            },
            include
          })
      )
    );
  }

  async getSsoProfileById(d: { ssoProfileId: string; instance: Instance }) {
    let user = await db.ssoUserProfile.findUnique({
      where: {
        id: d.ssoProfileId,
        ssoUser: {
          ssoTenant: {
            organizationOid: d.instance.organizationOid
          }
        }
      },
      include
    });
    if (!user) throw new ServiceError(notFoundError('sso.user'));
    return user;
  }
}

export let ssoProfileService = Service.create(
  'ssoProfileService',
  () => new ssoProfileServiceImpl()
).build();
