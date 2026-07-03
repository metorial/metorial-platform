import type { DirectorySyncEvent, Group, User, UserWithGroup } from '@boxyhq/saml-jackson';
import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { SsoDirectory } from '../../../prisma/generated/client';
import { db } from '../../db';
import { getId } from '../../id';
import { reconcileSingleSsoUserQueue } from '../../queues/reconcileSsoUsers';
import type { SsoUserChangeSource } from '../../queues/recordSsoUserChanges';
import { ssoGroupRoleService } from './groupRole';
import { ssoIdentityService } from './identity';
import type { SsoDirectoryWithApp } from './types';
import { hashUid, uniqueValues } from './utils';

let upsertUserProfileFromDirectoryUser = async (d: {
  directory: SsoDirectory;
  userPayload: User;
  syncRoles: boolean;
  enqueueReconciliation?: boolean;
  reconciliationSource?: SsoUserChangeSource;
  scimOperationId?: string;
}) => {
  let directory = await db.ssoDirectory.findUnique({
    where: { oid: d.directory.oid },
    include: { connection: { include: { tenant: true } } }
  });
  if (!directory) throw new ServiceError(notFoundError('sso.directory'));

  let user = await ssoIdentityService.upsertUser({
    tenant: directory.connection.tenant,
    email: d.userPayload.email,
    firstName: d.userPayload.first_name,
    lastName: d.userPayload.last_name,
    status: d.userPayload.active ? 'active' : 'deprovisioned'
  });

  let linkedProfile = await db.ssoDirectoryUserProfile.findFirst({
    where: {
      directoryOid: directory.oid,
      externalId: d.userPayload.id
    },
    include: { userProfile: true }
  });

  let profile =
    linkedProfile?.userProfile ??
    (await db.ssoUserProfile.findFirst({
      where: {
        tenantOid: directory.connection.tenantOid,
        connectionOid: directory.connectionOid,
        userOid: user.oid
      }
    }));

  if (!profile) {
    profile = await ssoIdentityService.upsertUserProfile({
      tenant: directory.connection.tenant,
      connection: directory.connection,
      user,
      updateMemberships: false,
      enqueueReconciliation: false,
      reconciliationSource: d.reconciliationSource,
      reconciliationScimOperationId: d.scimOperationId,
      data: {
        email: d.userPayload.email,
        uid: d.userPayload.id,
        uidHash: hashUid(d.userPayload.id),
        firstName: d.userPayload.first_name,
        lastName: d.userPayload.last_name,
        roles: [],
        groups: [],
        raw: d.userPayload.raw ?? d.userPayload
      }
    });
  } else {
    profile = await db.ssoUserProfile.update({
      where: { oid: profile.oid },
      data: {
        status: d.userPayload.active ? 'active' : 'deprovisioned',
        email: d.userPayload.email,
        firstName: d.userPayload.first_name,
        lastName: d.userPayload.last_name,
        raw: d.userPayload.raw ?? d.userPayload
      }
    });
  }

  await ssoIdentityService.linkDirectoryUserProfile({
    directory,
    userProfile: profile,
    externalId: d.userPayload.id,
    raw: d.userPayload.raw ?? d.userPayload
  });

  profile = await db.ssoUserProfile.update({
    where: { oid: profile.oid },
    data: {
      ownerDirectoryOid: directory.oid,
      status: d.userPayload.active ? 'active' : 'deprovisioned'
    }
  });

  if (d.syncRoles) {
    let roles = d.userPayload.roles ?? [];

    await ssoGroupRoleService.replaceUserProfileRoles({
      connection: directory.connection,
      userProfile: profile,
      roles
    });

    profile = await db.ssoUserProfile.update({
      where: { oid: profile.oid },
      data: {
        roles,
        isGroupRoleMemberReconciled: true
      }
    });
  }

  if (d.enqueueReconciliation ?? true) {
    await reconcileSingleSsoUserQueue.add({
      ssoUserId: user.id,
      source: d.reconciliationSource ?? 'directory_user_changed',
      scimOperationId: d.scimOperationId
    });
  }

  return { directory, user, profile };
};

class SsoDirectorySyncServiceImpl {
  async beginScimOperation(d: {
    directory?: SsoDirectoryWithApp | null;
    input: {
      internalDirectoryId: string;
      method: string;
      resourceType: string;
      resourceId?: string;
      query?: Record<string, any>;
      requestBody?: any;
    };
  }) {
    try {
      return await db.ssoScimOperation.create({
        data: {
          ...getId('ssoScimOperation'),
          directoryOid: d.directory?.oid,
          appOid: d.directory?.connection?.tenant?.appOid,
          internalDirectoryId: d.input.internalDirectoryId,
          method: d.input.method,
          resourceType: d.input.resourceType,
          resourceId: d.input.resourceId,
          query: d.input.query,
          requestBody: d.input.requestBody,
          statusCode: 0,
          success: false,
          durationMs: 0,
          eventNames: []
        }
      });
    } catch (error) {
      console.warn('Failed to begin SCIM operation', error);
      return null;
    }
  }

  async completeScimOperation(d: {
    scimOperationId: string;
    input: {
      responseBody?: any;
      statusCode: number;
      success: boolean;
      durationMs: number;
      eventNames: string[];
      errorMessage?: string;
    };
  }) {
    try {
      await db.ssoScimOperation.update({
        where: { id: d.scimOperationId },
        data: {
          responseBody: d.input.responseBody,
          statusCode: d.input.statusCode,
          success: d.input.success,
          durationMs: d.input.durationMs,
          eventNames: uniqueValues(d.input.eventNames),
          errorMessage: d.input.errorMessage
        }
      });
    } catch (error) {
      console.warn('Failed to complete SCIM operation', error);
    }
  }

  async recordScimOperation(d: {
    directory?: SsoDirectoryWithApp | null;
    input: {
      internalDirectoryId: string;
      method: string;
      resourceType: string;
      resourceId?: string;
      query?: Record<string, any>;
      requestBody?: any;
      responseBody?: any;
      statusCode: number;
      success: boolean;
      durationMs: number;
      eventNames: string[];
      errorMessage?: string;
    };
  }) {
    try {
      await db.ssoScimOperation.create({
        data: {
          ...getId('ssoScimOperation'),
          directoryOid: d.directory?.oid,
          appOid: d.directory?.connection?.tenant?.appOid,
          internalDirectoryId: d.input.internalDirectoryId,
          method: d.input.method,
          resourceType: d.input.resourceType,
          resourceId: d.input.resourceId,
          query: d.input.query,
          requestBody: d.input.requestBody,
          responseBody: d.input.responseBody,
          statusCode: d.input.statusCode,
          success: d.input.success,
          durationMs: d.input.durationMs,
          eventNames: uniqueValues(d.input.eventNames),
          errorMessage: d.input.errorMessage
        }
      });
    } catch (error) {
      console.warn('Failed to record SCIM operation', error);
    }
  }

  async handleDirectorySyncEvent(d: {
    directory: SsoDirectory;
    event: DirectorySyncEvent;
    scimOperationId?: string;
  }) {
    let eventName = d.event.event;

    if (eventName === 'user.created' || eventName === 'user.updated') {
      return await this.syncUserFromDirectoryEvent(d);
    }

    if (eventName === 'user.deleted') {
      return await this.deleteUserFromDirectoryEvent(d);
    }

    if (eventName === 'group.created' || eventName === 'group.updated') {
      return await this.syncGroupFromDirectoryEvent(d);
    }

    if (eventName === 'group.deleted') {
      return await this.deleteGroupFromDirectoryEvent(d);
    }

    if (eventName === 'group.user_added' || eventName === 'group.user_removed') {
      return await this.syncGroupMembershipFromDirectoryEvent({
        ...d,
        member: eventName === 'group.user_added'
      });
    }
  }

  async syncUserFromDirectoryEvent(d: {
    directory: SsoDirectory;
    event: DirectorySyncEvent;
    scimOperationId?: string;
  }) {
    let { profile } = await upsertUserProfileFromDirectoryUser({
      directory: d.directory,
      userPayload: d.event.data as User,
      syncRoles: true,
      scimOperationId: d.scimOperationId
    });

    return profile;
  }

  async syncGroupFromDirectoryEvent(d: {
    directory: SsoDirectory;
    event: DirectorySyncEvent;
  }) {
    let directory = await db.ssoDirectory.findUnique({
      where: { oid: d.directory.oid },
      include: { connection: true }
    });
    if (!directory) throw new ServiceError(notFoundError('sso.directory'));

    let groupPayload = d.event.data as Group;

    return await ssoGroupRoleService.upsertGroup({
      connection: directory.connection,
      value: groupPayload.id,
      displayName: groupPayload.name,
      metadata: {
        raw: groupPayload.raw ?? groupPayload
      }
    });
  }

  async syncGroupMembershipFromDirectoryEvent(d: {
    directory: SsoDirectory;
    event: DirectorySyncEvent;
    member: boolean;
    scimOperationId?: string;
  }) {
    let directory = await db.ssoDirectory.findUnique({
      where: { oid: d.directory.oid },
      include: { connection: true }
    });
    if (!directory) throw new ServiceError(notFoundError('sso.directory'));

    let userPayload = d.event.data as UserWithGroup;
    let { user, profile } = await upsertUserProfileFromDirectoryUser({
      directory,
      userPayload,
      syncRoles: true,
      enqueueReconciliation: false,
      scimOperationId: d.scimOperationId
    });

    await ssoGroupRoleService.upsertGroup({
      connection: directory.connection,
      value: userPayload.group.id,
      displayName: userPayload.group.name,
      metadata: {
        raw: userPayload.group.raw ?? userPayload.group
      }
    });

    await ssoGroupRoleService.setUserProfileGroupMembership({
      connection: directory.connection,
      userProfile: profile,
      groupValue: userPayload.group.id,
      member: d.member
    });

    let groups = d.member
      ? uniqueValues([...profile.groups, userPayload.group.id])
      : profile.groups.filter(group => group !== userPayload.group.id);

    let updatedProfile = await db.ssoUserProfile.update({
      where: { oid: profile.oid },
      data: {
        groups,
        isGroupRoleMemberReconciled: true
      }
    });

    await reconcileSingleSsoUserQueue.add({
      ssoUserId: user.id,
      source: 'directory_group_membership_changed',
      scimOperationId: d.scimOperationId
    });

    return updatedProfile;
  }

  async deleteUserFromDirectoryEvent(d: {
    directory: SsoDirectory;
    event: DirectorySyncEvent;
    scimOperationId?: string;
  }) {
    let externalId = d.event.data.id;
    if (!externalId) return;

    let link = await db.ssoDirectoryUserProfile.findFirst({
      where: { directoryOid: d.directory.oid, externalId },
      include: { userProfile: true }
    });
    if (!link) return;

    await db.ssoDirectoryUserProfile.update({
      where: { oid: link.oid },
      data: { deprovisionedAt: new Date() }
    });

    if (link.userProfile.ownerDirectoryOid === d.directory.oid) {
      await db.ssoUserProfile.update({
        where: { oid: link.userProfile.oid },
        data: {
          ownerDirectoryOid: null,
          status: 'deprovisioned',
          groups: [],
          roles: []
        }
      });

      let connection = await db.ssoConnection.findUniqueOrThrow({
        where: { oid: d.directory.connectionOid }
      });

      await ssoGroupRoleService.replaceUserProfileGroups({
        connection,
        userProfile: link.userProfile,
        groups: []
      });
      await ssoGroupRoleService.replaceUserProfileRoles({
        connection,
        userProfile: link.userProfile,
        roles: []
      });

      let user = await db.ssoUser.findUnique({
        where: { oid: link.userProfile.userOid }
      });
      if (user) {
        await reconcileSingleSsoUserQueue.add({
          ssoUserId: user.id,
          source: 'directory_user_deleted',
          scimOperationId: d.scimOperationId
        });
      }
    }
  }

  async deleteGroupFromDirectoryEvent(d: {
    directory: SsoDirectory;
    event: DirectorySyncEvent;
    scimOperationId?: string;
  }) {
    let directory = await db.ssoDirectory.findUnique({
      where: { oid: d.directory.oid },
      include: { connection: true }
    });
    if (!directory) throw new ServiceError(notFoundError('sso.directory'));

    let groupPayload = d.event.data as Group;

    let group = await db.ssoConnectionGroup.findFirst({
      where: {
        connectionOid: directory.connectionOid,
        value: groupPayload.id
      }
    });
    if (!group) return;

    let affectedLinks = await db.ssoUserProfileGroup.findMany({
      where: { groupOid: group.oid },
      include: { userProfile: { include: { ownedUser: true } } }
    });

    await db.ssoUserProfileGroup.deleteMany({ where: { groupOid: group.oid } });

    let affectedProfiles = new Map(
      affectedLinks.map(link => [link.userProfile.oid, link.userProfile])
    );

    for (let profile of affectedProfiles.values()) {
      await db.ssoUserProfile.update({
        where: { oid: profile.oid },
        data: {
          groups: profile.groups.filter(groupValue => groupValue !== group.value),
          isGroupRoleMemberReconciled: true
        }
      });

      if (!profile.ownedUser) continue;

      await reconcileSingleSsoUserQueue.add({
        ssoUserId: profile.ownedUser.id,
        source: 'directory_group_deleted',
        scimOperationId: d.scimOperationId
      });
    }
  }
}

export let ssoDirectorySyncService = Service.create(
  'SsoDirectorySyncService',
  () => new SsoDirectorySyncServiceImpl()
).build();
