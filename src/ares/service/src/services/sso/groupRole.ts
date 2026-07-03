import { badRequestError, ServiceError } from '@lowerdeck/error';
import type {
  SsoConnection,
  SsoTenant,
  SsoUserProfile
} from '../../../prisma/generated/client';
import { db, withTransaction } from '../../db';
import { getId } from '../../id';
import { isUniqueConstraintError, uniqueValues } from './utils';

export let ssoGroupRoleService = {
  async upsertRootGroup(d: {
    tenant: SsoTenant | { oid: bigint };
    value: string;
    displayName?: string | null;
    metadata?: Record<string, any>;
  }) {
    let value = d.value;
    if (!value) {
      throw new ServiceError(badRequestError({ message: 'Group value is required' }));
    }

    let existing = await db.ssoGroup.findFirst({
      where: { tenantOid: d.tenant.oid, value }
    });

    if (existing) {
      return await db.ssoGroup.update({
        where: { oid: existing.oid },
        data: {
          displayName: d.displayName ?? undefined,
          metadata: d.metadata ?? undefined
        }
      });
    }

    try {
      return await db.ssoGroup.create({
        data: {
          ...getId('ssoGroup'),
          tenantOid: d.tenant.oid,
          value,
          displayName: d.displayName ?? null,
          metadata: d.metadata ?? undefined
        }
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;

      let group = await db.ssoGroup.findFirst({
        where: { tenantOid: d.tenant.oid, value }
      });
      if (!group) throw error;
      return group;
    }
  },

  async upsertRootRole(d: {
    tenant: SsoTenant | { oid: bigint };
    value: string;
    displayName?: string | null;
    metadata?: Record<string, any>;
  }) {
    let value = d.value;
    if (!value) throw new ServiceError(badRequestError({ message: 'Role value is required' }));

    let existing = await db.ssoRole.findFirst({
      where: { tenantOid: d.tenant.oid, value }
    });

    if (existing) {
      return await db.ssoRole.update({
        where: { oid: existing.oid },
        data: {
          displayName: d.displayName ?? undefined,
          metadata: d.metadata ?? undefined
        }
      });
    }

    try {
      return await db.ssoRole.create({
        data: {
          ...getId('ssoRole'),
          tenantOid: d.tenant.oid,
          value,
          displayName: d.displayName ?? null,
          metadata: d.metadata ?? undefined
        }
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;

      let role = await db.ssoRole.findFirst({
        where: { tenantOid: d.tenant.oid, value }
      });
      if (!role) throw error;
      return role;
    }
  },

  async upsertGroup(d: {
    connection: SsoConnection;
    value: string;
    displayName?: string | null;
    metadata?: Record<string, any>;
  }) {
    let value = d.value;
    if (!value) {
      throw new ServiceError(badRequestError({ message: 'Group value is required' }));
    }

    let rootGroup = await this.upsertRootGroup({
      tenant: { oid: d.connection.tenantOid },
      value,
      displayName: d.displayName,
      metadata: d.metadata
    });

    let existing = await db.ssoConnectionGroup.findFirst({
      where: { connectionOid: d.connection.oid, value }
    });

    if (existing) {
      return await db.ssoConnectionGroup.update({
        where: { oid: existing.oid },
        data: {
          rootGroupOid: rootGroup.oid,
          displayName: d.displayName ?? undefined,
          metadata: d.metadata ?? undefined
        }
      });
    }

    try {
      return await db.ssoConnectionGroup.create({
        data: {
          ...getId('ssoConnectionGroup'),
          connectionOid: d.connection.oid,
          rootGroupOid: rootGroup.oid,
          value,
          displayName: d.displayName ?? null,
          metadata: d.metadata ?? undefined
        }
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;

      let group = await db.ssoConnectionGroup.findFirst({
        where: { connectionOid: d.connection.oid, value }
      });
      if (!group) throw error;
      if (group.rootGroupOid === rootGroup.oid) return group;

      return await db.ssoConnectionGroup.update({
        where: { oid: group.oid },
        data: { rootGroupOid: rootGroup.oid }
      });
    }
  },

  async upsertRole(d: {
    connection: SsoConnection;
    value: string;
    displayName?: string | null;
    metadata?: Record<string, any>;
  }) {
    let value = d.value;
    if (!value) throw new ServiceError(badRequestError({ message: 'Role value is required' }));

    let rootRole = await this.upsertRootRole({
      tenant: { oid: d.connection.tenantOid },
      value,
      displayName: d.displayName,
      metadata: d.metadata
    });

    let existing = await db.ssoConnectionRole.findFirst({
      where: { connectionOid: d.connection.oid, value }
    });

    if (existing) {
      return await db.ssoConnectionRole.update({
        where: { oid: existing.oid },
        data: {
          rootRoleOid: rootRole.oid,
          displayName: d.displayName ?? undefined,
          metadata: d.metadata ?? undefined
        }
      });
    }

    try {
      return await db.ssoConnectionRole.create({
        data: {
          ...getId('ssoConnectionRole'),
          connectionOid: d.connection.oid,
          rootRoleOid: rootRole.oid,
          value,
          displayName: d.displayName ?? null,
          metadata: d.metadata ?? undefined
        }
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;

      let role = await db.ssoConnectionRole.findFirst({
        where: { connectionOid: d.connection.oid, value }
      });
      if (!role) throw error;
      if (role.rootRoleOid === rootRole.oid) return role;

      return await db.ssoConnectionRole.update({
        where: { oid: role.oid },
        data: { rootRoleOid: rootRole.oid }
      });
    }
  },

  async replaceUserProfileGroups(d: {
    connection: SsoConnection;
    userProfile: SsoUserProfile;
    groups: string[];
  }) {
    let groups = uniqueValues(d.groups);

    await withTransaction(async tdb => {
      await tdb.ssoUserProfileGroup.deleteMany({
        where: { userProfileOid: d.userProfile.oid }
      });

      for (let value of groups) {
        let group = await this.upsertGroup({
          connection: d.connection,
          value,
          displayName: value
        });

        try {
          await tdb.ssoUserProfileGroup.create({
            data: {
              ...getId('ssoUserProfileGroup'),
              userProfileOid: d.userProfile.oid,
              groupOid: group.oid
            }
          });
        } catch (error) {
          if (!isUniqueConstraintError(error)) throw error;
        }
      }
    });
  },

  async replaceUserProfileRoles(d: {
    connection: SsoConnection;
    userProfile: SsoUserProfile;
    roles: string[];
  }) {
    let roles = uniqueValues(d.roles);

    await withTransaction(async tdb => {
      await tdb.ssoUserProfileRole.deleteMany({
        where: { userProfileOid: d.userProfile.oid }
      });

      for (let value of roles) {
        let role = await this.upsertRole({
          connection: d.connection,
          value,
          displayName: value
        });

        try {
          await tdb.ssoUserProfileRole.create({
            data: {
              ...getId('ssoUserProfileRole'),
              userProfileOid: d.userProfile.oid,
              roleOid: role.oid
            }
          });
        } catch (error) {
          if (!isUniqueConstraintError(error)) throw error;
        }
      }
    });
  },

  async setUserProfileGroupMembership(d: {
    connection: SsoConnection;
    userProfile: SsoUserProfile;
    groupValue: string;
    member: boolean;
  }) {
    let group = await this.upsertGroup({
      connection: d.connection,
      value: d.groupValue,
      displayName: d.groupValue
    });

    if (d.member) {
      let existing = await db.ssoUserProfileGroup.findFirst({
        where: {
          userProfileOid: d.userProfile.oid,
          groupOid: group.oid
        }
      });
      if (existing) return existing;

      try {
        return await db.ssoUserProfileGroup.create({
          data: {
            ...getId('ssoUserProfileGroup'),
            userProfileOid: d.userProfile.oid,
            groupOid: group.oid
          }
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;

        return await db.ssoUserProfileGroup.findFirst({
          where: {
            userProfileOid: d.userProfile.oid,
            groupOid: group.oid
          }
        });
      }
    }

    await db.ssoUserProfileGroup.deleteMany({
      where: {
        userProfileOid: d.userProfile.oid,
        groupOid: group.oid
      }
    });
  }
};
