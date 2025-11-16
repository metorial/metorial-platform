import { db, SsoTenant } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Service } from '@metorial/service';
import { Paginator } from '../../../../../packages/server/pagination/src';

let include = {
  profiles: true
};

class ssoUserServiceImpl {
  async listSsoUsers(d: { ssoTenant: SsoTenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.ssoUser.findMany({
            ...opts,
            where: {
              ssoTenantOid: d.ssoTenant.oid
            },
            include
          })
      )
    );
  }

  async getSsoUserById(d: { ssoUserId: string; ssoTenant: SsoTenant }) {
    let user = await db.ssoUser.findUnique({
      where: {
        id: d.ssoUserId,
        ssoTenantOid: d.ssoTenant.oid
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
