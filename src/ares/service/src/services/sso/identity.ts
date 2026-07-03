import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  Prisma,
  SsoConnection,
  SsoDirectory,
  SsoTenant,
  SsoUser,
  SsoUserProfile,
  SsoUserProfileStatus,
  SsoUserStatus
} from '../../../prisma/generated/client';
import { db } from '../../db';
import { getId } from '../../id';
import { reconcileSingleSsoUserQueue } from '../../queues/reconcileSsoUsers';
import type { SsoUserChangeSource } from '../../queues/recordSsoUserChanges';
import { ssoGroupRoleService } from './groupRole';

let ssoUserProfileNestedInclude = {
  connection: true,
  ownerDirectory: true,
  directories: { include: { directory: true } },
  groupLinks: { include: { group: { include: { rootGroup: true } } } },
  roleLinks: { include: { role: { include: { rootRole: true } } } }
} satisfies Prisma.SsoUserProfileInclude;

let ssoUserProfileInclude = {
  ...ssoUserProfileNestedInclude,
  user: true
} satisfies Prisma.SsoUserProfileInclude;

let ssoUserInclude = {
  ownerProfile: { include: ssoUserProfileNestedInclude },
  profiles: { include: ssoUserProfileNestedInclude },
  groupLinks: { include: { group: true } },
  roleLinks: { include: { role: true } }
} satisfies Prisma.SsoUserInclude;

let ssoUserChangeInclude = {
  scimOperation: true
} satisfies Prisma.SsoUserChangeInclude;

let setSsoUserOwnerProfile = async (d: {
  user: SsoUser;
  profile: SsoUserProfile;
  enqueueReconciliation?: boolean;
  reconciliationSource?: SsoUserChangeSource;
  reconciliationScimOperationId?: string;
}) => {
  let user = await db.ssoUser.update({
    where: { oid: d.user.oid },
    data: { ownerProfileOid: d.profile.oid }
  });

  if (d.enqueueReconciliation ?? true) {
    await reconcileSingleSsoUserQueue.add({
      ssoUserId: user.id,
      source: d.reconciliationSource ?? 'owner_profile_changed',
      scimOperationId: d.reconciliationScimOperationId
    });
  }

  return user;
};

let shouldSetUserOwnerProfileFromUpsert = async (d: {
  user: SsoUser;
  profile: SsoUserProfile;
}) => {
  if (d.profile.ownerDirectoryOid) return true;

  let currentUser = await db.ssoUser.findUnique({
    where: { oid: d.user.oid },
    select: {
      ownerProfile: { select: { ownerDirectoryOid: true } }
    }
  });

  return !currentUser?.ownerProfile?.ownerDirectoryOid;
};

class SsoIdentityServiceImpl {
  async upsertUser(d: {
    tenant: SsoTenant;
    email: string;
    firstName: string;
    lastName: string;
    status?: 'active' | 'deprovisioned';
  }) {
    let existing = await db.ssoUser.findFirst({
      where: { tenantOid: d.tenant.oid, email: d.email }
    });

    if (existing) {
      return await db.ssoUser.update({
        where: { oid: existing.oid },
        data: {
          status: d.status ?? 'active',
          firstName: d.firstName,
          lastName: d.lastName
        },
        include: ssoUserInclude
      });
    }

    return await db.ssoUser.create({
      data: {
        ...getId('ssoUser'),
        status: d.status ?? 'active',
        tenantOid: d.tenant.oid,
        email: d.email,
        firstName: d.firstName,
        lastName: d.lastName
      },
      include: ssoUserInclude
    });
  }

  async createUser(d: {
    tenant: SsoTenant;
    input: {
      email: string;
      firstName: string;
      lastName: string;
      status?: 'active' | 'deprovisioned';
    };
  }) {
    return await db.ssoUser.create({
      data: {
        ...getId('ssoUser'),
        tenantOid: d.tenant.oid,
        email: d.input.email,
        firstName: d.input.firstName,
        lastName: d.input.lastName,
        status: d.input.status ?? 'active'
      },
      include: ssoUserInclude
    });
  }

  async listUsers(d: {
    tenant: SsoTenant;
    filters?: {
      userIds?: string[];
      userProfileIds?: string[];
      connectionIds?: string[];
      groupIds?: string[];
      roleIds?: string[];
      uids?: string[];
      directoryIds?: string[];
      externalIds?: string[];
      emails?: string[];
      statuses?: string[];
    };
  }) {
    let where: Prisma.SsoUserWhereInput = {
      tenantOid: d.tenant.oid,
      id: d.filters?.userIds?.length ? { in: d.filters.userIds } : undefined,
      status: d.filters?.statuses?.length
        ? { in: d.filters.statuses as SsoUserStatus[] }
        : undefined,
      AND: [
        d.filters?.connectionIds?.length
          ? {
              profiles: { some: { connection: { id: { in: d.filters.connectionIds } } } }
            }
          : undefined,
        d.filters?.userProfileIds?.length
          ? { profiles: { some: { id: { in: d.filters.userProfileIds } } } }
          : undefined,
        d.filters?.uids?.length
          ? { profiles: { some: { uid: { in: d.filters.uids } } } }
          : undefined,
        d.filters?.directoryIds?.length
          ? {
              profiles: {
                some: {
                  directories: { some: { directory: { id: { in: d.filters.directoryIds } } } }
                }
              }
            }
          : undefined,
        d.filters?.externalIds?.length
          ? {
              profiles: {
                some: { directories: { some: { externalId: { in: d.filters.externalIds } } } }
              }
            }
          : undefined,
        d.filters?.emails?.length
          ? {
              OR: [
                { email: { in: d.filters.emails } },
                { profiles: { some: { email: { in: d.filters.emails } } } }
              ]
            }
          : undefined,
        d.filters?.groupIds?.length
          ? {
              OR: [
                { groupLinks: { some: { group: { id: { in: d.filters.groupIds } } } } },
                {
                  profiles: {
                    some: {
                      groupLinks: { some: { group: { id: { in: d.filters.groupIds } } } }
                    }
                  }
                },
                {
                  profiles: {
                    some: {
                      groupLinks: {
                        some: { group: { rootGroup: { id: { in: d.filters.groupIds } } } }
                      }
                    }
                  }
                }
              ]
            }
          : undefined,
        d.filters?.roleIds?.length
          ? {
              OR: [
                { roleLinks: { some: { role: { id: { in: d.filters.roleIds } } } } },
                {
                  profiles: {
                    some: { roleLinks: { some: { role: { id: { in: d.filters.roleIds } } } } }
                  }
                },
                {
                  profiles: {
                    some: {
                      roleLinks: {
                        some: { role: { rootRole: { id: { in: d.filters.roleIds } } } }
                      }
                    }
                  }
                }
              ]
            }
          : undefined
      ].filter(Boolean) as Prisma.SsoUserWhereInput[]
    };

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.ssoUser.findMany({
            ...opts,
            where,
            include: ssoUserInclude
          })
      )
    );
  }

  async getUserById(d: { tenant: SsoTenant; userId: string }) {
    let user = await db.ssoUser.findFirst({
      where: { tenantOid: d.tenant.oid, id: d.userId },
      include: ssoUserInclude
    });
    if (!user) throw new ServiceError(notFoundError('sso.user'));
    return user;
  }

  async updateUser(d: {
    tenant: SsoTenant;
    user: SsoUser;
    input: {
      email?: string;
      firstName?: string;
      lastName?: string;
      status?: 'active' | 'deprovisioned';
    };
  }) {
    if (d.user.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('sso.user'));
    }

    return await db.ssoUser.update({
      where: { oid: d.user.oid },
      data: {
        email: d.input.email,
        firstName: d.input.firstName,
        lastName: d.input.lastName,
        status: d.input.status
      },
      include: ssoUserInclude
    });
  }

  async deleteUser(d: { tenant: SsoTenant; user: SsoUser }) {
    return await this.updateUser({
      tenant: d.tenant,
      user: d.user,
      input: { status: 'deprovisioned' }
    });
  }

  async listUserProfiles(d: {
    tenant: SsoTenant;
    connection?: SsoConnection;
    filters?: {
      userIds?: string[];
      userProfileIds?: string[];
      connectionIds?: string[];
      groupIds?: string[];
      roleIds?: string[];
      uids?: string[];
      directoryIds?: string[];
      externalIds?: string[];
      emails?: string[];
      statuses?: string[];
    };
  }) {
    let where: Prisma.SsoUserProfileWhereInput = {
      tenantOid: d.tenant.oid,
      id: d.filters?.userProfileIds?.length ? { in: d.filters.userProfileIds } : undefined,
      status: d.filters?.statuses?.length
        ? { in: d.filters.statuses as SsoUserProfileStatus[] }
        : undefined,
      uid: d.filters?.uids?.length ? { in: d.filters.uids } : undefined,
      connectionOid: d.connection?.oid,
      connection: d.filters?.connectionIds?.length
        ? { id: { in: d.filters.connectionIds } }
        : undefined,
      user: {
        id: d.filters?.userIds?.length ? { in: d.filters.userIds } : undefined,
        email: d.filters?.emails?.length ? { in: d.filters.emails } : undefined
      },
      AND: [
        d.filters?.emails?.length ? { OR: [{ email: { in: d.filters.emails } }] } : undefined,
        d.filters?.directoryIds?.length
          ? {
              directories: { some: { directory: { id: { in: d.filters.directoryIds } } } }
            }
          : undefined,
        d.filters?.externalIds?.length
          ? { directories: { some: { externalId: { in: d.filters.externalIds } } } }
          : undefined,
        d.filters?.groupIds?.length
          ? {
              OR: [
                { groupLinks: { some: { group: { id: { in: d.filters.groupIds } } } } },
                {
                  groupLinks: {
                    some: { group: { rootGroup: { id: { in: d.filters.groupIds } } } }
                  }
                }
              ]
            }
          : undefined,
        d.filters?.roleIds?.length
          ? {
              OR: [
                { roleLinks: { some: { role: { id: { in: d.filters.roleIds } } } } },
                {
                  roleLinks: {
                    some: { role: { rootRole: { id: { in: d.filters.roleIds } } } }
                  }
                }
              ]
            }
          : undefined
      ].filter(Boolean) as Prisma.SsoUserProfileWhereInput[]
    };

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.ssoUserProfile.findMany({
            ...opts,
            where,
            include: ssoUserProfileInclude
          })
      )
    );
  }

  async getUserProfileById(d: {
    tenant: SsoTenant;
    userProfileId: string;
    connection?: SsoConnection;
  }) {
    let profile = await db.ssoUserProfile.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        id: d.userProfileId,
        connectionOid: d.connection?.oid
      },
      include: ssoUserProfileInclude
    });
    if (!profile) throw new ServiceError(notFoundError('sso.user_profile'));
    return profile;
  }

  async listUserUpdates(d: {
    tenant: SsoTenant;
    filters?: {
      userIds?: string[];
      emails?: string[];
      statuses?: string[];
    };
  }) {
    let where: Prisma.SsoUserChangeWhereInput = {
      tenantOid: d.tenant.oid,
      userId: d.filters?.userIds?.length ? { in: d.filters.userIds } : undefined,
      email: d.filters?.emails?.length ? { in: d.filters.emails } : undefined,
      status: d.filters?.statuses?.length
        ? { in: d.filters.statuses as SsoUserStatus[] }
        : undefined
    };

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.ssoUserChange.findMany({
            ...opts,
            where,
            include: ssoUserChangeInclude
          })
      )
    );
  }

  async getUserUpdateById(d: { tenant: SsoTenant; userUpdateId: string }) {
    let update = await db.ssoUserChange.findFirst({
      where: { tenantOid: d.tenant.oid, id: d.userUpdateId },
      include: ssoUserChangeInclude
    });
    if (!update) throw new ServiceError(notFoundError('sso.user_update'));
    return update;
  }

  async upsertUserProfile(d: {
    tenant: SsoTenant;
    connection: SsoConnection;
    user: SsoUser;
    updateMemberships?: boolean;
    enqueueReconciliation?: boolean;
    reconciliationSource?: SsoUserChangeSource;
    reconciliationScimOperationId?: string;
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

      if (await shouldSetUserOwnerProfileFromUpsert({ user: d.user, profile })) {
        await setSsoUserOwnerProfile({
          user: d.user,
          profile,
          enqueueReconciliation: d.enqueueReconciliation,
          reconciliationSource: d.reconciliationSource,
          reconciliationScimOperationId: d.reconciliationScimOperationId
        });
      }

      return await this.getUserProfileById({
        tenant: d.tenant,
        userProfileId: profile.id
      });
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

    if (await shouldSetUserOwnerProfileFromUpsert({ user: d.user, profile })) {
      await setSsoUserOwnerProfile({
        user: d.user,
        profile,
        enqueueReconciliation: d.enqueueReconciliation,
        reconciliationSource: d.reconciliationSource,
        reconciliationScimOperationId: d.reconciliationScimOperationId
      });
    }

    return await this.getUserProfileById({
      tenant: d.tenant,
      userProfileId: profile.id
    });
  }

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
  }

  async setUserProfileOwnerDirectory(d: {
    userProfile: SsoUserProfile;
    directory: SsoDirectory;
  }) {
    return await db.ssoUserProfile.update({
      where: { oid: d.userProfile.oid },
      data: { ownerDirectoryOid: d.directory.oid }
    });
  }

  async setUserOwnerProfile(d: {
    user: SsoUser;
    profile: SsoUserProfile;
    enqueueReconciliation?: boolean;
    reconciliationSource?: SsoUserChangeSource;
    reconciliationScimOperationId?: string;
  }) {
    return await setSsoUserOwnerProfile(d);
  }
}

export let ssoIdentityService = Service.create(
  'SsoIdentityService',
  () => new SsoIdentityServiceImpl()
).build();
