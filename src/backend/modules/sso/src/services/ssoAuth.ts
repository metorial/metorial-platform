import { db, ID, SsoTenant } from '@metorial/db';
import { Service } from '@metorial/service';
import { sso } from '../sso';

class ssoAuthServiceImpl {
  async startSsoAuth(d: {
    tenant: SsoTenant;
    input: {
      redirectUri: string;
      state: string;
    };
  }) {
    return await sso.auth.start({
      tenantId: d.tenant.ssoTenantId,
      redirectUri: d.input.redirectUri,
      state: d.input.state
    });
  }

  async completeSsoAuth(d: { authId: string }) {
    let res = await sso.auth.complete({
      authId: d.authId
    });

    let tenant = await db.ssoTenant.findFirstOrThrow({
      where: { ssoTenantId: res.tenant.id }
    });

    let currentUser = await db.ssoUser.findUnique({
      where: {
        ssoUserId: res.user.id,
        ssoTenantOid: tenant.oid
      }
    });
    let allGroups = [...new Set([...(currentUser?.allGroups || []), ...res.profile.groups])];
    let allRoles = [...new Set([...(currentUser?.allRoles || []), ...res.profile.roles])];

    let missingGroupsFromTenant = allGroups.filter(g => !tenant.availableGroups.includes(g));
    let missingRolesFromTenant = allRoles.filter(r => !tenant.availableRoles.includes(r));

    if (missingGroupsFromTenant.length || missingRolesFromTenant.length) {
      await db.ssoTenant.updateMany({
        where: { oid: tenant.oid },
        data: {
          availableGroups: [
            ...new Set([...tenant.availableGroups, ...missingGroupsFromTenant])
          ],
          availableRoles: [...new Set([...tenant.availableRoles, ...missingRolesFromTenant])]
        }
      });
    }

    let ssoUserData = {
      ssoTenantOid: tenant.oid,
      ssoUserId: res.user.id,
      email: res.user.email,
      firstName: res.user.firstName,
      lastName: res.user.lastName,
      allGroups,
      allRoles
    };
    let user = await db.ssoUser.upsert({
      where: {
        ssoUserId: res.user.id,
        ssoTenantOid: tenant.oid
      },
      update: ssoUserData,
      create: {
        id: await ID.generateId('ssoUser'),
        ...ssoUserData
      }
    });

    let ssoProfileData = {
      ssoConnectionId: res.profile.connectionId,
      email: res.profile.email,
      uid: res.profile.uid,
      sub: res.profile.sub,
      firstName: res.profile.firstName,
      lastName: res.profile.lastName,
      roles: res.profile.roles,
      groups: res.profile.groups
    };
    let profile = await db.ssoUserProfile.upsert({
      where: {
        id: res.profile.id,
        ssoUserOid: user.oid
      },
      update: ssoProfileData,
      create: {
        id: res.profile.id,
        ssoUserOid: user.oid,
        ...ssoProfileData
      }
    });

    return {
      tenant,
      user,
      profile,
      state: res.auth.state
    };
  }
}

export let ssoAuthService = Service.create(
  'ssoAuthService',
  () => new ssoAuthServiceImpl()
).build();
