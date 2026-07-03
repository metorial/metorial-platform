import type {
  SsoConnection,
  SsoDirectory,
  SsoTenant,
  SsoUser,
  SsoUserProfile
} from '../../../prisma/generated/client';
import { db } from '../../db';
import { getId } from '../../id';
import { reconcileSingleSsoUserQueue } from '../../queues/reconcileSsoUsers';
import type { SsoUserChangeSource } from '../../queues/recordSsoUserChanges';
import { ssoGroupRoleService } from './groupRole';

let setSsoUserOwnerProfile = async (d: {
  user: SsoUser;
  profile: SsoUserProfile;
  enqueueReconciliation?: boolean;
  reconciliationSource?: SsoUserChangeSource;
}) => {
  let user = await db.ssoUser.update({
    where: { oid: d.user.oid },
    data: { ownerProfileOid: d.profile.oid }
  });

  if (d.enqueueReconciliation ?? true) {
    await reconcileSingleSsoUserQueue.add({
      ssoUserId: user.id,
      source: d.reconciliationSource ?? 'owner_profile_changed'
    });
  }

  return user;
};

export let ssoIdentityService = {
  async upsertUser(d: {
    tenant: SsoTenant;
    email: string;
    firstName: string;
    lastName: string;
  }) {
    let existing = await db.ssoUser.findFirst({
      where: { tenantOid: d.tenant.oid, email: d.email }
    });

    if (existing) {
      return await db.ssoUser.update({
        where: { oid: existing.oid },
        data: {
          status: 'active',
          firstName: d.firstName,
          lastName: d.lastName
        }
      });
    }

    return await db.ssoUser.create({
      data: {
        ...getId('ssoUser'),
        status: 'active',
        tenantOid: d.tenant.oid,
        email: d.email,
        firstName: d.firstName,
        lastName: d.lastName
      }
    });
  },

  async upsertUserProfile(d: {
    tenant: SsoTenant;
    connection: SsoConnection;
    user: SsoUser;
    updateMemberships?: boolean;
    enqueueReconciliation?: boolean;
    reconciliationSource?: SsoUserChangeSource;
    data: {
      email: string;
      uid: string;
      uidHash: string;
      sub?: string;
      firstName: string;
      lastName: string;
      roles: string[];
      groups: string[];
      raw: any;
    };
  }) {
    let existing = await db.ssoUserProfile.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        userOid: d.user.oid,
        connectionOid: d.connection.oid,
        uidHash: d.data.uidHash
      }
    });

    if (existing) {
      let shouldUpdateMemberships = d.updateMemberships ?? !existing.ownerDirectoryOid;

      let profile = await db.ssoUserProfile.update({
        where: { oid: existing.oid },
        data: {
          status: 'active',
          email: d.data.email,
          uid: d.data.uid,
          sub: d.data.sub ?? null,
          firstName: d.data.firstName,
          lastName: d.data.lastName,
          roles: shouldUpdateMemberships ? d.data.roles : undefined,
          groups: shouldUpdateMemberships ? d.data.groups : undefined,
          isGroupRoleMemberReconciled: shouldUpdateMemberships ? true : undefined,
          raw: d.data.raw
        }
      });

      if (shouldUpdateMemberships) {
        await ssoGroupRoleService.replaceUserProfileGroups({
          connection: d.connection,
          userProfile: profile,
          groups: d.data.groups
        });
        await ssoGroupRoleService.replaceUserProfileRoles({
          connection: d.connection,
          userProfile: profile,
          roles: d.data.roles
        });
      }

      await setSsoUserOwnerProfile({
        user: d.user,
        profile,
        enqueueReconciliation: d.enqueueReconciliation,
        reconciliationSource: d.reconciliationSource
      });

      return profile;
    }

    let profile = await db.ssoUserProfile.create({
      data: {
        ...getId('ssoUserProfile'),
        status: 'active',
        tenantOid: d.tenant.oid,
        connectionOid: d.connection.oid,
        userOid: d.user.oid,
        email: d.data.email,
        uid: d.data.uid,
        uidHash: d.data.uidHash,
        sub: d.data.sub ?? null,
        firstName: d.data.firstName,
        lastName: d.data.lastName,
        roles: d.data.roles,
        groups: d.data.groups,
        isGroupRoleMemberReconciled: d.updateMemberships ?? true,
        raw: d.data.raw
      }
    });

    if (d.updateMemberships ?? true) {
      await ssoGroupRoleService.replaceUserProfileGroups({
        connection: d.connection,
        userProfile: profile,
        groups: d.data.groups
      });
      await ssoGroupRoleService.replaceUserProfileRoles({
        connection: d.connection,
        userProfile: profile,
        roles: d.data.roles
      });
    }

    await setSsoUserOwnerProfile({
      user: d.user,
      profile,
      enqueueReconciliation: d.enqueueReconciliation,
      reconciliationSource: d.reconciliationSource
    });

    return profile;
  },

  async linkDirectoryUserProfile(d: {
    directory: SsoDirectory;
    userProfile: SsoUserProfile;
    externalId?: string | null;
    raw?: any;
  }) {
    let existing = await db.ssoDirectoryUserProfile.findFirst({
      where: {
        directoryOid: d.directory.oid,
        userProfileOid: d.userProfile.oid
      }
    });

    if (!existing && d.externalId) {
      existing = await db.ssoDirectoryUserProfile.findFirst({
        where: {
          directoryOid: d.directory.oid,
          externalId: d.externalId
        }
      });
    }

    if (existing) {
      return await db.ssoDirectoryUserProfile.update({
        where: { oid: existing.oid },
        data: {
          userProfileOid: d.userProfile.oid,
          externalId: d.externalId ?? existing.externalId,
          raw: d.raw ?? undefined,
          lastSeenAt: new Date(),
          deprovisionedAt: null
        }
      });
    }

    try {
      return await db.ssoDirectoryUserProfile.create({
        data: {
          ...getId('ssoDirectoryUserProfile'),
          directoryOid: d.directory.oid,
          userProfileOid: d.userProfile.oid,
          externalId: d.externalId ?? null,
          raw: d.raw ?? undefined,
          lastSeenAt: new Date()
        }
      });
    } catch (error) {
      let link = await db.ssoDirectoryUserProfile.findFirst({
        where: {
          directoryOid: d.directory.oid,
          OR: [
            { userProfileOid: d.userProfile.oid },
            ...(d.externalId ? [{ externalId: d.externalId }] : [])
          ]
        }
      });
      if (!link) throw error;

      return await db.ssoDirectoryUserProfile.update({
        where: { oid: link.oid },
        data: {
          userProfileOid: d.userProfile.oid,
          externalId: d.externalId ?? link.externalId,
          raw: d.raw ?? undefined,
          lastSeenAt: new Date(),
          deprovisionedAt: null
        }
      });
    }
  },

  async setUserProfileOwnerDirectory(d: {
    userProfile: SsoUserProfile;
    directory: SsoDirectory;
  }) {
    return await db.ssoUserProfile.update({
      where: { oid: d.userProfile.oid },
      data: { ownerDirectoryOid: d.directory.oid }
    });
  }
};
