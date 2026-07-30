import type {
  SsoConnection,
  SsoConnectionGroup,
  SsoConnectionRole,
  SsoDirectory,
  SsoDirectoryGroup,
  SsoDirectoryRole,
  SsoDirectoryUserProfile,
  SsoGroup,
  SsoRole,
  SsoScimOperation,
  SsoTenant,
  SsoUser,
  SsoUserChange,
  SsoUserGroup,
  SsoUserProfile,
  SsoUserProfileGroup,
  SsoUserProfileRole,
  SsoUserRole
} from '../../../../prisma/generated/client';
import { env } from '../../../env';
import { jackson } from '../../../lib/jackson';

export let ssoTenantRefPresenter = (
  tenant: Pick<SsoTenant, 'id' | 'name' | 'status' | 'clientId' | 'externalId'>
) => ({
  object: 'ares#ssoTenant' as const,
  id: tenant.id,
  name: tenant.name,
  status: tenant.status,
  clientId: tenant.clientId,
  externalId: tenant.externalId
});

export let ssoConnectionRefPresenter = (
  connection: Pick<
    SsoConnection,
    'id' | 'name' | 'status' | 'providerType' | 'providerName'
  >
) => ({
  object: 'ares#ssoConnection' as const,
  id: connection.id,
  name: connection.name,
  status: connection.status,
  providerType: connection.providerType,
  providerName: connection.providerName
});

export let ssoDirectoryRefPresenter = (
  directory: Pick<SsoDirectory, 'id' | 'name' | 'status' | 'type'>
) => ({
  object: 'ares#ssoDirectory' as const,
  id: directory.id,
  name: directory.name,
  status: directory.status,
  type: directory.type
});

export let ssoGroupRefPresenter = (
  group: Pick<SsoGroup, 'id' | 'value' | 'displayName'>
) => ({
  object: 'ares#ssoGroup' as const,
  id: group.id,
  value: group.value,
  displayName: group.displayName
});

export let ssoRoleRefPresenter = (
  role: Pick<SsoRole, 'id' | 'value' | 'displayName'>
) => ({
  object: 'ares#ssoRole' as const,
  id: role.id,
  value: role.value,
  displayName: role.displayName
});

export let ssoConnectionGroupRefPresenter = (
  group: Pick<SsoConnectionGroup, 'id' | 'value' | 'displayName'>
) => ({
  object: 'ares#ssoConnectionGroup' as const,
  id: group.id,
  value: group.value,
  displayName: group.displayName
});

export let ssoConnectionRoleRefPresenter = (
  role: Pick<SsoConnectionRole, 'id' | 'value' | 'displayName'>
) => ({
  object: 'ares#ssoConnectionRole' as const,
  id: role.id,
  value: role.value,
  displayName: role.displayName
});

export let ssoUserRefPresenter = (
  user: Pick<SsoUser, 'id' | 'email' | 'firstName' | 'lastName' | 'status'>
) => ({
  object: 'ares#ssoUser' as const,
  id: user.id,
  status: user.status,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName
});

export let ssoUserProfileRefPresenter = (
  profile: Pick<
    SsoUserProfile,
    'id' | 'email' | 'uid' | 'firstName' | 'lastName' | 'status'
  >
) => ({
  object: 'ares#ssoUserProfile' as const,
  id: profile.id,
  status: profile.status,
  email: profile.email,
  uid: profile.uid,
  firstName: profile.firstName,
  lastName: profile.lastName
});

export let ssoScimOperationPresenter = (operation: SsoScimOperation) => ({
  object: 'ares#ssoScimOperation' as const,
  id: operation.id,
  method: operation.method,
  resourceType: operation.resourceType,
  resourceId: operation.resourceId,
  statusCode: operation.statusCode,
  success: operation.success,
  durationMs: operation.durationMs,
  eventNames: operation.eventNames,
  errorMessage: operation.errorMessage,
  createdAt: operation.createdAt
});

export let ssoScimLogPresenter = (operation: SsoScimOperation) => ({
  ...ssoScimOperationPresenter(operation),
  query: operation.query,
  requestBody: operation.requestBody,
  responseBody: operation.responseBody
});

export let ssoTenantPresenter = (
  tenant: SsoTenant & {
    _count?: { connections?: number };
    app?: { id: string; clientId: string } | null;
    account?: {
      id: string;
      clientId: string;
      identifier: string;
      name: string;
    } | null;
  }
) => ({
  object: 'ares#ssoTenant' as const,
  id: tenant.id,
  name: tenant.name,
  status: tenant.status,
  clientId: tenant.clientId,
  externalId: tenant.externalId,
  metadata: tenant.metadata,
  enrollment: tenant.enrollment,
  hideInUI: tenant.hideInUI,
  entityId: env.sso.SAML_AUDIENCE,
  replyUrl: jackson.defaultRedirectUrl.saml,
  redirectUri: jackson.defaultRedirectUrl.oidc,
  source: tenant.importedDelegationOid ? ('imported' as const) : ('local' as const),
  isEditable: !tenant.importedDelegationOid,
  counts: {
    connections: tenant._count?.connections ?? 0
  },
  app: tenant.app
    ? {
        object: 'ares#app' as const,
        id: tenant.app.id,
        clientId: tenant.app.clientId
      }
    : null,
  account: tenant.account
    ? {
        object: 'ares#account' as const,
        id: tenant.account.id,
        clientId: tenant.account.clientId,
        identifier: tenant.account.identifier,
        name: tenant.account.name
      }
    : null,
  createdAt: tenant.createdAt,
  updatedAt: tenant.updatedAt
});

export let ssoConnectionPresenter = (
  connection: SsoConnection & {
    tenant?: SsoTenant | null;
    directories?: SsoDirectory[];
    groups?: (SsoConnectionGroup & { rootGroup?: SsoGroup | null })[];
    roles?: (SsoConnectionRole & { rootRole?: SsoRole | null })[];
  }
) => ({
  object: 'ares#ssoConnection' as const,
  id: connection.id,
  name: connection.name,
  status: connection.status,
  providerType: connection.providerType,
  providerName: connection.providerName,
  metadata: connection.metadata,
  source: connection.importedDelegationOid ? ('imported' as const) : ('local' as const),
  sourceId: connection.sourceId,
  isEditable: !connection.importedDelegationOid,
  tenant: connection.tenant ? ssoTenantRefPresenter(connection.tenant) : null,
  directories: (connection.directories ?? []).map(ssoDirectoryRefPresenter),
  groups: (connection.groups ?? []).map(ssoConnectionGroupRefPresenter),
  roles: (connection.roles ?? []).map(ssoConnectionRoleRefPresenter),
  createdAt: connection.createdAt,
  updatedAt: connection.updatedAt
});

export let ssoDirectoryPresenter = (
  directory: SsoDirectory & {
    connection?: (SsoConnection & { tenant?: SsoTenant | null }) | null;
  }
) => ({
  object: 'ares#ssoDirectory' as const,
  id: directory.id,
  name: directory.name,
  type: directory.type,
  status: directory.status,
  metadata: directory.metadata,
  scimPath: directory.scimPath,
  scimEndpoint: directory.scimEndpoint,
  tenant: directory.connection?.tenant ? ssoTenantRefPresenter(directory.connection.tenant) : null,
  connection: directory.connection ? ssoConnectionRefPresenter(directory.connection) : null,
  createdAt: directory.createdAt,
  updatedAt: directory.updatedAt
});

export let ssoCatalogGroupPresenter = (group: SsoGroup) => ({
  object: 'ares#ssoCatalogGroup' as const,
  id: group.id,
  value: group.value,
  displayName: group.displayName,
  metadata: group.metadata,
  createdAt: group.createdAt,
  updatedAt: group.updatedAt
});

export let ssoCatalogRolePresenter = (role: SsoRole) => ({
  object: 'ares#ssoCatalogRole' as const,
  id: role.id,
  value: role.value,
  displayName: role.displayName,
  metadata: role.metadata,
  createdAt: role.createdAt,
  updatedAt: role.updatedAt
});

export let ssoCatalogConnectionGroupPresenter = (
  group: SsoConnectionGroup & {
    connection: Pick<SsoConnection, 'id'>;
    rootGroup: Pick<SsoGroup, 'id'> | null;
  }
) => ({
  object: 'ares#ssoCatalogConnectionGroup' as const,
  id: group.id,
  connectionId: group.connection.id,
  groupId: group.rootGroup?.id ?? null,
  value: group.value,
  displayName: group.displayName,
  metadata: group.metadata,
  createdAt: group.createdAt,
  updatedAt: group.updatedAt
});

export let ssoCatalogConnectionRolePresenter = (
  role: SsoConnectionRole & {
    connection: Pick<SsoConnection, 'id'>;
    rootRole: Pick<SsoRole, 'id'> | null;
  }
) => ({
  object: 'ares#ssoCatalogConnectionRole' as const,
  id: role.id,
  connectionId: role.connection.id,
  roleId: role.rootRole?.id ?? null,
  value: role.value,
  displayName: role.displayName,
  metadata: role.metadata,
  createdAt: role.createdAt,
  updatedAt: role.updatedAt
});

export let ssoCatalogDirectoryGroupPresenter = (
  link: Pick<SsoDirectoryGroup, 'id' | 'createdAt' | 'updatedAt'> & {
    directory: Pick<SsoDirectory, 'id'>;
    group: Pick<SsoConnectionGroup, 'id'>;
  }
) => ({
  object: 'ares#ssoCatalogDirectoryGroup' as const,
  id: link.id,
  directoryId: link.directory.id,
  connectionGroupId: link.group.id,
  createdAt: link.createdAt,
  updatedAt: link.updatedAt
});

export let ssoCatalogDirectoryRolePresenter = (
  link: Pick<SsoDirectoryRole, 'id' | 'createdAt' | 'updatedAt'> & {
    directory: Pick<SsoDirectory, 'id'>;
    role: Pick<SsoConnectionRole, 'id'>;
  }
) => ({
  object: 'ares#ssoCatalogDirectoryRole' as const,
  id: link.id,
  directoryId: link.directory.id,
  connectionRoleId: link.role.id,
  createdAt: link.createdAt,
  updatedAt: link.updatedAt
});

export let ssoGroupPresenter = (
  group: SsoGroup & {
    connectionGroups?: (SsoConnectionGroup & {
      connection?: SsoConnection | null;
      rootGroup?: SsoGroup | null;
    })[];
  }
) => ({
  object: 'ares#ssoGroup' as const,
  id: group.id,
  value: group.value,
  displayName: group.displayName,
  metadata: group.metadata,
  connectionGroups: (group.connectionGroups ?? []).map(connectionGroup => ({
    ...ssoConnectionGroupRefPresenter(connectionGroup),
    connection: connectionGroup.connection
      ? ssoConnectionRefPresenter(connectionGroup.connection)
      : null
  })),
  createdAt: group.createdAt,
  updatedAt: group.updatedAt
});

export let ssoRolePresenter = (
  role: SsoRole & {
    connectionRoles?: (SsoConnectionRole & {
      connection?: SsoConnection | null;
      rootRole?: SsoRole | null;
    })[];
  }
) => ({
  object: 'ares#ssoRole' as const,
  id: role.id,
  value: role.value,
  displayName: role.displayName,
  metadata: role.metadata,
  connectionRoles: (role.connectionRoles ?? []).map(connectionRole => ({
    ...ssoConnectionRoleRefPresenter(connectionRole),
    connection: connectionRole.connection
      ? ssoConnectionRefPresenter(connectionRole.connection)
      : null
  })),
  createdAt: role.createdAt,
  updatedAt: role.updatedAt
});

export let ssoConnectionGroupPresenter = (
  group: SsoConnectionGroup & {
    connection?: SsoConnection | null;
    rootGroup?: (SsoGroup & {
      connectionGroups?: (SsoConnectionGroup & { connection?: SsoConnection | null })[];
    }) | null;
  }
) => ({
  object: 'ares#ssoConnectionGroup' as const,
  id: group.id,
  value: group.value,
  displayName: group.displayName,
  metadata: group.metadata,
  connection: group.connection ? ssoConnectionRefPresenter(group.connection) : null,
  rootGroup: group.rootGroup ? ssoGroupRefPresenter(group.rootGroup) : null,
  rootGroupConnectionGroups: (group.rootGroup?.connectionGroups ?? []).map(connectionGroup => ({
    ...ssoConnectionGroupRefPresenter(connectionGroup),
    connection: connectionGroup.connection
      ? ssoConnectionRefPresenter(connectionGroup.connection)
      : null
  })),
  createdAt: group.createdAt,
  updatedAt: group.updatedAt
});

export let ssoConnectionRolePresenter = (
  role: SsoConnectionRole & {
    connection?: SsoConnection | null;
    rootRole?: (SsoRole & {
      connectionRoles?: (SsoConnectionRole & { connection?: SsoConnection | null })[];
    }) | null;
  }
) => ({
  object: 'ares#ssoConnectionRole' as const,
  id: role.id,
  value: role.value,
  displayName: role.displayName,
  metadata: role.metadata,
  connection: role.connection ? ssoConnectionRefPresenter(role.connection) : null,
  rootRole: role.rootRole ? ssoRoleRefPresenter(role.rootRole) : null,
  rootRoleConnectionRoles: (role.rootRole?.connectionRoles ?? []).map(connectionRole => ({
    ...ssoConnectionRoleRefPresenter(connectionRole),
    connection: connectionRole.connection
      ? ssoConnectionRefPresenter(connectionRole.connection)
      : null
  })),
  createdAt: role.createdAt,
  updatedAt: role.updatedAt
});

export let ssoUserProfilePresenter = (
  profile: SsoUserProfile & {
    user?: SsoUser | null;
    connection?: SsoConnection | null;
    ownerDirectory?: SsoDirectory | null;
    directories?: (SsoDirectoryUserProfile & { directory: SsoDirectory })[];
    groupLinks?: (SsoUserProfileGroup & {
      group: SsoConnectionGroup & { rootGroup?: SsoGroup | null };
    })[];
    roleLinks?: (SsoUserProfileRole & {
      role: SsoConnectionRole & { rootRole?: SsoRole | null };
    })[];
  }
) => ({
  object: 'ares#ssoUserProfile' as const,
  id: profile.id,
  status: profile.status,
  email: profile.email,
  uid: profile.uid,
  sub: profile.sub,
  firstName: profile.firstName,
  lastName: profile.lastName,
  roles: profile.roles,
  groups: profile.groups,
  metadata: profile.metadata,
  raw: profile.raw,
  user: profile.user ? ssoUserRefPresenter(profile.user) : null,
  connection: profile.connection ? ssoConnectionRefPresenter(profile.connection) : null,
  ownerDirectory: profile.ownerDirectory
    ? ssoDirectoryRefPresenter(profile.ownerDirectory)
    : null,
  directories: (profile.directories ?? []).map(directoryLink => ({
    object: 'ares#ssoDirectoryUserProfile' as const,
    id: directoryLink.id,
    externalId: directoryLink.externalId,
    lastSeenAt: directoryLink.lastSeenAt,
    deprovisionedAt: directoryLink.deprovisionedAt,
    directory: ssoDirectoryRefPresenter(directoryLink.directory),
    createdAt: directoryLink.createdAt,
    updatedAt: directoryLink.updatedAt
  })),
  connectionGroups: (profile.groupLinks ?? []).map(link => ({
    ...ssoConnectionGroupRefPresenter(link.group),
    rootGroup: link.group.rootGroup ? ssoGroupRefPresenter(link.group.rootGroup) : null
  })),
  connectionRoles: (profile.roleLinks ?? []).map(link => ({
    ...ssoConnectionRoleRefPresenter(link.role),
    rootRole: link.role.rootRole ? ssoRoleRefPresenter(link.role.rootRole) : null
  })),
  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt
});

export let ssoUserPresenter = (
  user: SsoUser & {
    ownerProfile?: (SsoUserProfile & {
      connection?: SsoConnection | null;
      ownerDirectory?: SsoDirectory | null;
      directories?: (SsoDirectoryUserProfile & { directory: SsoDirectory })[];
      groupLinks?: (SsoUserProfileGroup & {
        group: SsoConnectionGroup & { rootGroup?: SsoGroup | null };
      })[];
      roleLinks?: (SsoUserProfileRole & {
        role: SsoConnectionRole & { rootRole?: SsoRole | null };
      })[];
    }) | null;
    profiles?: (SsoUserProfile & {
      connection?: SsoConnection | null;
      ownerDirectory?: SsoDirectory | null;
      directories?: (SsoDirectoryUserProfile & { directory: SsoDirectory })[];
      groupLinks?: (SsoUserProfileGroup & {
        group: SsoConnectionGroup & { rootGroup?: SsoGroup | null };
      })[];
      roleLinks?: (SsoUserProfileRole & {
        role: SsoConnectionRole & { rootRole?: SsoRole | null };
      })[];
    })[];
    groupLinks?: (SsoUserGroup & { group: SsoGroup })[];
    roleLinks?: (SsoUserRole & { role: SsoRole })[];
  }
) => ({
  object: 'ares#ssoUser' as const,
  id: user.id,
  status: user.status,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  ownerProfile: user.ownerProfile ? ssoUserProfileRefPresenter(user.ownerProfile) : null,
  profiles: (user.profiles ?? []).map(profile =>
    ssoUserProfilePresenter({ ...profile, user: null as any })
  ),
  groups: (user.groupLinks ?? []).map(link => ssoGroupRefPresenter(link.group)),
  roles: (user.roleLinks ?? []).map(link => ssoRoleRefPresenter(link.role)),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

let sanitizeSsoUserChangeSnapshot = (snapshot: any) => {
  if (!snapshot) return null;

  return {
    user: snapshot.user
      ? {
          id: snapshot.user.id,
          status: snapshot.user.status,
          email: snapshot.user.email,
          firstName: snapshot.user.firstName,
          lastName: snapshot.user.lastName
        }
      : null,
    ownerProfile: snapshot.ownerProfile
      ? {
          id: snapshot.ownerProfile.id,
          status: snapshot.ownerProfile.status,
          email: snapshot.ownerProfile.email,
          firstName: snapshot.ownerProfile.firstName,
          lastName: snapshot.ownerProfile.lastName
        }
      : null,
    assignedGroups: snapshot.assignedGroups ?? [],
    assignedRoles: snapshot.assignedRoles ?? []
  };
};

export let ssoUserUpdatePresenter = (
  update: SsoUserChange & {
    scimOperation?: SsoScimOperation | null;
  }
) => ({
  object: 'ares#ssoUserUpdate' as const,
  id: update.id,
  userId: update.userId,
  status: update.status,
  email: update.email,
  firstName: update.firstName,
  lastName: update.lastName,
  source: update.source,
  changedFields: update.changedFields,
  assignedGroups: update.assignedGroups,
  assignedRoles: update.assignedRoles,
  snapshot: sanitizeSsoUserChangeSnapshot(update.snapshot),
  scimOperation: update.scimOperation ? ssoScimOperationPresenter(update.scimOperation) : null,
  createdAt: update.createdAt
});
