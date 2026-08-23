import type { DirectorySyncEvent, Group, User, UserWithGroup } from '@boxyhq/saml-jackson';
import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  Prisma,
  SsoConnectionGroup,
  SsoDirectory,
  SsoTenant
} from '../../../prisma/generated/client';
import { db } from '../../db';
import { getId } from '../../id';
import { reconcileSingleSsoUserQueue } from '../../queues/reconcileSsoUsers';
import type { SsoUserChangeSource } from '../../queues/recordSsoUserChanges';
import {
  markAresSsoTenantChanged,
  markAresSsoTenantChangedForConnection
} from '../../queues/syncCallback';
import { ssoGroupRoleService } from './groupRole';
import { ssoIdentityService } from './identity';
import type { SsoDirectoryWithApp } from './types';
import { hashUid, uniqueValues } from './utils';

let getPersistedUserProfileGroups = async (userProfileOid: bigint) => {
  let groupLinks = await db.ssoUserProfileGroup.findMany({
    where: { userProfileOid },
    select: { group: { select: { value: true } } },
    orderBy: { oid: 'asc' }
  });

  return uniqueValues(groupLinks.map(link => link.group.value));
};

type ScimGroupMember = {
  value: string;
  display?: string;
};

let getDirectoryGroupValue = (group: Group) => {
  if (!group.name) {
    throw new ServiceError(
      badRequestError({ message: 'SCIM group display name is required' })
    );
  }

  return group.name;
};

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

  await ssoIdentityService.setUserOwnerProfile({
    user,
    profile,
    enqueueReconciliation: false,
    reconciliationSource: d.reconciliationSource,
    reconciliationScimOperationId: d.scimOperationId
  });

  if (!d.userPayload.active) {
    await ssoGroupRoleService.replaceUserProfileGroups({
      connection: directory.connection,
      userProfile: profile,
      groups: []
    });

    profile = await db.ssoUserProfile.update({
      where: { oid: profile.oid },
      data: {
        groups: [],
        isGroupRoleMemberReconciled: true
      }
    });
  }

  if (d.syncRoles) {
    let roles = d.userPayload.roles ?? [];

    await ssoGroupRoleService.replaceUserProfileRoles({
      connection: directory.connection,
      userProfile: profile,
      roles
    });
    await ssoGroupRoleService.reconcileDirectoryRoles({ directory });

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

  async listScimOperations(d: {
    tenant: SsoTenant;
    filters?: {
      directoryIds?: string[];
    };
  }) {
    let where: Prisma.SsoScimOperationWhereInput = {
      directory: {
        id: d.filters?.directoryIds?.length ? { in: d.filters.directoryIds } : undefined,
        connection: { tenantOid: d.tenant.oid }
      }
    };

    return Paginator.create(({ prisma }) =>
      prisma(async opts => await db.ssoScimOperation.findMany({ ...opts, where }))
    );
  }

  async listDirectoryGroupMembers(d: {
    directory: SsoDirectory;
    groupValue: string;
  }): Promise<ScimGroupMember[]> {
    let links = await db.ssoDirectoryUserProfile.findMany({
      where: {
        directoryOid: d.directory.oid,
        externalId: { not: null },
        deprovisionedAt: null,
        userProfile: {
          groupLinks: {
            some: {
              group: {
                connectionOid: d.directory.connectionOid,
                value: d.groupValue
              }
            }
          }
        }
      },
      select: {
        externalId: true,
        userProfile: { select: { email: true } }
      },
      orderBy: { oid: 'asc' }
    });

    return links.flatMap(link =>
      link.externalId ? [{ value: link.externalId, display: link.userProfile.email }] : []
    );
  }

  async replaceDirectoryGroupMembers(d: {
    directory: SsoDirectory;
    group: SsoConnectionGroup;
    members: ScimGroupMember[];
    scimOperationId?: string;
  }) {
    if (d.group.connectionOid !== d.directory.connectionOid) {
      throw new ServiceError(notFoundError('sso.group'));
    }

    if (
      !Array.isArray(d.members) ||
      d.members.some(member => !member || typeof member.value !== 'string' || !member.value)
    ) {
      throw new ServiceError(
        badRequestError({ message: 'Every SCIM group member must have a value' })
      );
    }

    let memberValues = uniqueValues(d.members.map(member => member.value));
    let directoryLinks = memberValues.length
      ? await db.ssoDirectoryUserProfile.findMany({
          where: {
            directoryOid: d.directory.oid,
            externalId: { in: memberValues },
            deprovisionedAt: null
          },
          include: { userProfile: { include: { user: true } } }
        })
      : [];
    let directoryLinksByExternalId = new Map(
      directoryLinks.flatMap(link =>
        link.externalId ? [[link.externalId, link] as const] : []
      )
    );
    let missingMemberValues = memberValues.filter(
      memberValue => !directoryLinksByExternalId.has(memberValue)
    );

    if (missingMemberValues.length) {
      throw new ServiceError(
        badRequestError({
          message: `SCIM group references unknown users: ${missingMemberValues.join(', ')}`
        })
      );
    }

    let existingMemberships = await db.ssoUserProfileGroup.findMany({
      where: {
        groupOid: d.group.oid,
        userProfile: {
          directories: {
            some: {
              directoryOid: d.directory.oid,
              deprovisionedAt: null
            }
          }
        }
      },
      include: { userProfile: { include: { user: true } } }
    });
    let desiredProfileOids = new Set(directoryLinks.map(link => link.userProfileOid));
    let existingProfileOids = new Set(
      existingMemberships.map(membership => membership.userProfileOid)
    );
    let affectedProfiles = new Map<
      bigint,
      (typeof existingMemberships)[number]['userProfile']
    >();

    for (let membership of existingMemberships) {
      if (desiredProfileOids.has(membership.userProfileOid)) continue;

      await db.ssoUserProfileGroup.delete({ where: { oid: membership.oid } });
      affectedProfiles.set(membership.userProfileOid, membership.userProfile);
    }

    for (let link of directoryLinks) {
      if (existingProfileOids.has(link.userProfileOid)) continue;

      await db.ssoUserProfileGroup.upsert({
        where: {
          userProfileOid_groupOid: {
            userProfileOid: link.userProfileOid,
            groupOid: d.group.oid
          }
        },
        create: {
          ...getId('ssoUserProfileGroup'),
          userProfileOid: link.userProfileOid,
          groupOid: d.group.oid
        },
        update: {}
      });
      affectedProfiles.set(link.userProfileOid, link.userProfile);
    }

    for (let profile of affectedProfiles.values()) {
      let groups = await getPersistedUserProfileGroups(profile.oid);

      await db.ssoUserProfile.update({
        where: { oid: profile.oid },
        data: {
          groups,
          isGroupRoleMemberReconciled: true
        }
      });

      await reconcileSingleSsoUserQueue.add({
        ssoUserId: profile.user.id,
        source: 'directory_group_membership_changed',
        scimOperationId: d.scimOperationId
      });
    }

    return await this.listDirectoryGroupMembers({
      directory: d.directory,
      groupValue: d.group.value
    });
  }

  async normalizeLegacyDirectoryGroup(d: {
    directory: SsoDirectory;
    group: SsoConnectionGroup;
    legacyGroupValue: string;
    scimOperationId?: string;
  }) {
    if (d.legacyGroupValue === d.group.value) return;

    let legacyGroup = await db.ssoConnectionGroup.findFirst({
      where: {
        connectionOid: d.directory.connectionOid,
        value: d.legacyGroupValue,
        directories: {
          some: { directoryOid: d.directory.oid },
          every: { directoryOid: d.directory.oid }
        }
      },
      include: {
        userProfiles: { include: { userProfile: { include: { user: true } } } }
      }
    });
    if (!legacyGroup || legacyGroup.oid === d.group.oid) return;

    let affectedProfiles = new Map(
      legacyGroup.userProfiles.map(link => [link.userProfileOid, link.userProfile])
    );

    for (let link of legacyGroup.userProfiles) {
      await db.ssoUserProfileGroup.upsert({
        where: {
          userProfileOid_groupOid: {
            userProfileOid: link.userProfileOid,
            groupOid: d.group.oid
          }
        },
        create: {
          ...getId('ssoUserProfileGroup'),
          userProfileOid: link.userProfileOid,
          groupOid: d.group.oid
        },
        update: {}
      });
    }

    await db.ssoConnectionGroup.delete({ where: { oid: legacyGroup.oid } });
    await markAresSsoTenantChangedForConnection({
      connectionOid: d.directory.connectionOid
    });

    for (let profile of affectedProfiles.values()) {
      let groups = await getPersistedUserProfileGroups(profile.oid);

      await db.ssoUserProfile.update({
        where: { oid: profile.oid },
        data: {
          groups,
          isGroupRoleMemberReconciled: true
        }
      });

      await reconcileSingleSsoUserQueue.add({
        ssoUserId: profile.user.id,
        source: 'directory_group_membership_changed',
        scimOperationId: d.scimOperationId
      });
    }

    await db.ssoGroup.deleteMany({
      where: {
        oid: legacyGroup.rootGroupOid ?? undefined,
        connectionGroups: { none: {} },
        users: { none: {} }
      }
    });
  }

  async handleDirectorySyncEvent(d: {
    directory: SsoDirectory;
    event: DirectorySyncEvent;
    scimOperationId?: string;
    scimRequest?: {
      method: string;
      resourceType: string;
      body?: any;
    };
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
    scimOperationId?: string;
    scimRequest?: {
      method: string;
      resourceType: string;
      body?: any;
    };
  }) {
    let directory = await db.ssoDirectory.findUnique({
      where: { oid: d.directory.oid },
      include: { connection: true }
    });
    if (!directory) throw new ServiceError(notFoundError('sso.directory'));

    let groupPayload = d.event.data as Group;
    let groupValue = getDirectoryGroupValue(groupPayload);

    let group = await ssoGroupRoleService.upsertGroup({
      connection: directory.connection,
      value: groupValue,
      displayName: groupPayload.name,
      metadata: {
        raw: groupPayload.raw ?? groupPayload
      }
    });
    await ssoGroupRoleService.linkDirectoryGroup({ directory, group });
    await this.normalizeLegacyDirectoryGroup({
      directory,
      group,
      legacyGroupValue: groupPayload.id,
      scimOperationId: d.scimOperationId
    });

    let scimMethod = d.scimRequest?.method.toUpperCase();
    let members = d.scimRequest?.body?.members;
    if (
      d.scimRequest?.resourceType.toLowerCase() === 'groups' &&
      (scimMethod === 'POST' || scimMethod === 'PUT') &&
      Array.isArray(members)
    ) {
      await this.replaceDirectoryGroupMembers({
        directory,
        group,
        members,
        scimOperationId: d.scimOperationId
      });
    }

    return group;
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
    let groupValue = getDirectoryGroupValue(userPayload.group);
    let { user, profile } = await upsertUserProfileFromDirectoryUser({
      directory,
      userPayload,
      syncRoles: true,
      enqueueReconciliation: false,
      scimOperationId: d.scimOperationId
    });

    let group = await ssoGroupRoleService.upsertGroup({
      connection: directory.connection,
      value: groupValue,
      displayName: userPayload.group.name,
      metadata: {
        raw: userPayload.group.raw ?? userPayload.group
      }
    });
    await ssoGroupRoleService.linkDirectoryGroup({ directory, group });
    await this.normalizeLegacyDirectoryGroup({
      directory,
      group,
      legacyGroupValue: userPayload.group.id,
      scimOperationId: d.scimOperationId
    });

    await ssoGroupRoleService.setUserProfileGroupMembership({
      connection: directory.connection,
      userProfile: profile,
      groupValue,
      member: d.member
    });

    let groups = await getPersistedUserProfileGroups(profile.oid);

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

    let connection = await db.ssoConnection.findUniqueOrThrow({
      where: { oid: d.directory.connectionOid }
    });

    await ssoGroupRoleService.replaceUserProfileGroups({
      connection,
      userProfile: link.userProfile,
      groups: []
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

      await ssoGroupRoleService.replaceUserProfileRoles({
        connection,
        userProfile: link.userProfile,
        roles: []
      });
      await ssoGroupRoleService.reconcileDirectoryRoles({ directory: d.directory });
    } else {
      await db.ssoUserProfile.update({
        where: { oid: link.userProfile.oid },
        data: {
          groups: [],
          isGroupRoleMemberReconciled: true
        }
      });
    }

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
    let groupValue = getDirectoryGroupValue(groupPayload);

    let group = await db.ssoConnectionGroup.findFirst({
      where: {
        connectionOid: directory.connectionOid,
        value: groupValue
      }
    });
    if (!group) return;

    let affectedLinks = await db.ssoUserProfileGroup.findMany({
      where: {
        groupOid: group.oid,
        userProfile: {
          directories: {
            some: { directoryOid: directory.oid, deprovisionedAt: null }
          }
        }
      },
      include: { userProfile: { include: { ownedUser: true } } }
    });

    let removedDirectoryGroups = await db.ssoDirectoryGroup.deleteMany({
      where: { directoryOid: directory.oid, groupOid: group.oid }
    });

    if (removedDirectoryGroups.count) {
      await markAresSsoTenantChanged({ tenantOid: directory.connection.tenantOid });
    }

    for (let link of affectedLinks) {
      let otherSource = await db.ssoDirectoryGroup.findFirst({
        where: {
          groupOid: group.oid,
          directory: {
            userProfiles: {
              some: {
                userProfileOid: link.userProfileOid,
                deprovisionedAt: null
              }
            }
          }
        }
      });
      if (!otherSource) {
        await db.ssoUserProfileGroup.delete({ where: { oid: link.oid } });
      }
    }

    let affectedProfiles = new Map(
      affectedLinks.map(link => [link.userProfile.oid, link.userProfile])
    );

    for (let profile of affectedProfiles.values()) {
      let groups = await getPersistedUserProfileGroups(profile.oid);

      await db.ssoUserProfile.update({
        where: { oid: profile.oid },
        data: {
          groups,
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
