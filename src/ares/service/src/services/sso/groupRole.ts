import { canonicalize } from '@lowerdeck/canonicalize';
import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  Prisma,
  SsoConnection,
  SsoConnectionGroup,
  SsoConnectionRole,
  SsoDirectory,
  SsoGroup,
  SsoRole,
  SsoTenant,
  SsoUserProfile
} from '../../../prisma/generated/client';
import { db, withTransaction } from '../../db';
import { getId } from '../../id';
import {
  markAresSsoTenantChanged,
  markAresSsoTenantChangedForConnection
} from '../../queues/syncCallback';
import { isUniqueConstraintError, uniqueValues } from './utils';

type CatalogEntry = { displayName: string | null; metadata: unknown };

let hasCatalogChange = (before: CatalogEntry, after: CatalogEntry) =>
  before.displayName !== after.displayName ||
  canonicalize(before.metadata ?? null) !== canonicalize(after.metadata ?? null);

let ssoRootGroupInclude = {
  connectionGroups: { include: { connection: true, rootGroup: true } }
} satisfies Prisma.SsoGroupInclude;

let ssoRootRoleInclude = {
  connectionRoles: { include: { connection: true, rootRole: true } }
} satisfies Prisma.SsoRoleInclude;

let ssoConnectionGroupInclude = {
  connection: true,
  rootGroup: { include: ssoRootGroupInclude }
} satisfies Prisma.SsoConnectionGroupInclude;

let ssoConnectionRoleInclude = {
  connection: true,
  rootRole: { include: ssoRootRoleInclude }
} satisfies Prisma.SsoConnectionRoleInclude;

class SsoGroupRoleServiceImpl {
  async linkDirectoryGroup(d: { directory: SsoDirectory; group: SsoConnectionGroup }) {
    if (d.group.connectionOid !== d.directory.connectionOid) {
      throw new ServiceError(notFoundError('sso.group'));
    }

    return await withTransaction(async tdb => {
      let key = {
        directoryOid_groupOid: {
          directoryOid: d.directory.oid,
          groupOid: d.group.oid
        }
      };

      let existing = await tdb.ssoDirectoryGroup.findUnique({ where: key });
      if (existing) return existing;

      let link = await tdb.ssoDirectoryGroup.upsert({
        where: key,
        create: {
          ...getId('ssoDirectoryGroup'),
          directoryOid: d.directory.oid,
          groupOid: d.group.oid
        },
        update: {}
      });

      await markAresSsoTenantChangedForConnection({
        connectionOid: d.directory.connectionOid
      });

      return link;
    });
  }

  async reconcileDirectoryRoles(d: { directory: SsoDirectory }) {
    if (d.directory.status !== 'active') {
      let removed = await db.ssoDirectoryRole.deleteMany({
        where: { directoryOid: d.directory.oid }
      });
      if (removed.count) {
        await markAresSsoTenantChangedForConnection({
          connectionOid: d.directory.connectionOid
        });
      }
      return;
    }

    let roles = await db.ssoConnectionRole.findMany({
      where: {
        connectionOid: d.directory.connectionOid,
        userProfiles: {
          some: {
            userProfile: {
              directories: {
                some: {
                  directoryOid: d.directory.oid,
                  deprovisionedAt: null
                }
              }
            }
          }
        }
      },
      select: { oid: true }
    });
    let roleOids = roles.map(role => role.oid);

    await withTransaction(async tdb => {
      let removed = await tdb.ssoDirectoryRole.deleteMany({
        where: {
          directoryOid: d.directory.oid,
          roleOid: roleOids.length ? { notIn: roleOids } : undefined
        }
      });

      let created = 0;

      for (let role of roles) {
        let key = {
          directoryOid_roleOid: {
            directoryOid: d.directory.oid,
            roleOid: role.oid
          }
        };

        let existing = await tdb.ssoDirectoryRole.findUnique({ where: key });
        if (existing) continue;

        await tdb.ssoDirectoryRole.upsert({
          where: key,
          create: {
            ...getId('ssoDirectoryRole'),
            directoryOid: d.directory.oid,
            roleOid: role.oid
          },
          update: {}
        });
        created += 1;
      }

      if (removed.count || created) {
        await markAresSsoTenantChangedForConnection({
          connectionOid: d.directory.connectionOid
        });
      }
    });
  }

  async syncConnectionGroupRoot(d: {
    group: SsoConnectionGroup;
    connection?: Pick<SsoConnection, 'tenantOid'>;
    rootGroup?: SsoGroup;
  }): Promise<{ group: SsoConnectionGroup; rootGroup: SsoGroup }> {
    return withTransaction(
      async db => {
        if (!d.group.value) {
          throw new ServiceError(badRequestError({ message: 'Group value is required' }));
        }

        let connection =
          d.connection ??
          (await db.ssoConnection.findUnique({
            where: { oid: d.group.connectionOid },
            select: { tenantOid: true }
          }));
        if (!connection) throw new ServiceError(notFoundError('sso.connection'));

        let rootGroup =
          d.rootGroup ??
          (await this.upsertRootGroup({
            tenant: { oid: connection.tenantOid },
            value: d.group.value,
            displayName: d.group.displayName,
            metadata: (d.group.metadata as Record<string, any> | null) ?? undefined
          }));

        if (d.group.rootGroupOid === rootGroup.oid) {
          return { group: d.group, rootGroup };
        }

        let group = await db.ssoConnectionGroup.update({
          where: { oid: d.group.oid },
          data: { rootGroupOid: rootGroup.oid }
        });

        await markAresSsoTenantChanged({ tenantOid: connection.tenantOid });

        return { group, rootGroup };
      },
      { ifExists: true }
    );
  }

  async syncConnectionRoleRoot(d: {
    role: SsoConnectionRole;
    connection?: Pick<SsoConnection, 'tenantOid'>;
    rootRole?: SsoRole;
  }): Promise<{ role: SsoConnectionRole; rootRole: SsoRole }> {
    return withTransaction(
      async db => {
        if (!d.role.value) {
          throw new ServiceError(badRequestError({ message: 'Role value is required' }));
        }

        let connection =
          d.connection ??
          (await db.ssoConnection.findUnique({
            where: { oid: d.role.connectionOid },
            select: { tenantOid: true }
          }));
        if (!connection) throw new ServiceError(notFoundError('sso.connection'));

        let rootRole =
          d.rootRole ??
          (await this.upsertRootRole({
            tenant: { oid: connection.tenantOid },
            value: d.role.value,
            displayName: d.role.displayName,
            metadata: (d.role.metadata as Record<string, any> | null) ?? undefined
          }));

        if (d.role.rootRoleOid === rootRole.oid) {
          return { role: d.role, rootRole };
        }

        let role = await db.ssoConnectionRole.update({
          where: { oid: d.role.oid },
          data: { rootRoleOid: rootRole.oid }
        });

        await markAresSsoTenantChanged({ tenantOid: connection.tenantOid });

        return { role, rootRole };
      },
      { ifExists: true }
    );
  }

  async upsertRootGroup(d: {
    tenant: SsoTenant | { oid: bigint };
    value: string;
    displayName?: string | null;
    metadata?: Record<string, any>;
  }) {
    return withTransaction(
      async db => {
        let value = d.value;
        if (!value) {
          throw new ServiceError(badRequestError({ message: 'Group value is required' }));
        }

        let existing = await db.ssoGroup.findFirst({
          where: { tenantOid: d.tenant.oid, value }
        });

        if (existing) {
          let group = await db.ssoGroup.update({
            where: { oid: existing.oid },
            data: {
              displayName: d.displayName ?? undefined,
              metadata: d.metadata ?? undefined
            },
            include: ssoRootGroupInclude
          });

          if (hasCatalogChange(existing, group)) {
            await markAresSsoTenantChanged({ tenantOid: d.tenant.oid });
          }

          return group;
        }

        try {
          let group = await db.ssoGroup.create({
            data: {
              ...getId('ssoGroup'),
              tenantOid: d.tenant.oid,
              value,
              displayName: d.displayName ?? null,
              metadata: d.metadata ?? undefined
            },
            include: ssoRootGroupInclude
          });

          await markAresSsoTenantChanged({ tenantOid: d.tenant.oid });

          return group;
        } catch (error) {
          if (!isUniqueConstraintError(error)) throw error;

          let group = await db.ssoGroup.findFirst({
            where: { tenantOid: d.tenant.oid, value },
            include: ssoRootGroupInclude
          });
          if (!group) throw error;
          return group;
        }
      },
      { ifExists: true }
    );
  }

  async upsertRootRole(d: {
    tenant: SsoTenant | { oid: bigint };
    value: string;
    displayName?: string | null;
    metadata?: Record<string, any>;
  }) {
    return withTransaction(
      async db => {
        let value = d.value;
        if (!value)
          throw new ServiceError(badRequestError({ message: 'Role value is required' }));

        let existing = await db.ssoRole.findFirst({
          where: { tenantOid: d.tenant.oid, value }
        });

        if (existing) {
          let role = await db.ssoRole.update({
            where: { oid: existing.oid },
            data: {
              displayName: d.displayName ?? undefined,
              metadata: d.metadata ?? undefined
            },
            include: ssoRootRoleInclude
          });

          if (hasCatalogChange(existing, role)) {
            await markAresSsoTenantChanged({ tenantOid: d.tenant.oid });
          }

          return role;
        }

        try {
          let role = await db.ssoRole.create({
            data: {
              ...getId('ssoRole'),
              tenantOid: d.tenant.oid,
              value,
              displayName: d.displayName ?? null,
              metadata: d.metadata ?? undefined
            },
            include: ssoRootRoleInclude
          });

          await markAresSsoTenantChanged({ tenantOid: d.tenant.oid });

          return role;
        } catch (error) {
          if (!isUniqueConstraintError(error)) throw error;

          let role = await db.ssoRole.findFirst({
            where: { tenantOid: d.tenant.oid, value },
            include: ssoRootRoleInclude
          });
          if (!role) throw error;
          return role;
        }
      },
      { ifExists: true }
    );
  }

  async upsertGroup(d: {
    connection: SsoConnection;
    value: string;
    displayName?: string | null;
    metadata?: Record<string, any>;
  }) {
    return withTransaction(
      async db => {
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
          let group = await db.ssoConnectionGroup.update({
            where: { oid: existing.oid },
            data: {
              rootGroupOid: rootGroup.oid,
              displayName: d.displayName ?? undefined,
              metadata: d.metadata ?? undefined
            }
          });

          if (hasCatalogChange(existing, group)) {
            await markAresSsoTenantChanged({ tenantOid: d.connection.tenantOid });
          }

          return (
            await this.syncConnectionGroupRoot({
              group,
              connection: d.connection,
              rootGroup
            })
          ).group;
        }

        try {
          let group = await db.ssoConnectionGroup.create({
            data: {
              ...getId('ssoConnectionGroup'),
              connectionOid: d.connection.oid,
              rootGroupOid: rootGroup.oid,
              value,
              displayName: d.displayName ?? null,
              metadata: d.metadata ?? undefined
            }
          });

          await markAresSsoTenantChanged({ tenantOid: d.connection.tenantOid });

          return (
            await this.syncConnectionGroupRoot({
              group,
              connection: d.connection,
              rootGroup
            })
          ).group;
        } catch (error) {
          if (!isUniqueConstraintError(error)) throw error;

          let group = await db.ssoConnectionGroup.findFirst({
            where: { connectionOid: d.connection.oid, value }
          });
          if (!group) throw error;

          return (
            await this.syncConnectionGroupRoot({
              group,
              connection: d.connection,
              rootGroup
            })
          ).group;
        }
      },
      { ifExists: true }
    );
  }

  async upsertRole(d: {
    connection: SsoConnection;
    value: string;
    displayName?: string | null;
    metadata?: Record<string, any>;
  }) {
    return withTransaction(
      async db => {
        let value = d.value;
        if (!value)
          throw new ServiceError(badRequestError({ message: 'Role value is required' }));

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
          let role = await db.ssoConnectionRole.update({
            where: { oid: existing.oid },
            data: {
              rootRoleOid: rootRole.oid,
              displayName: d.displayName ?? undefined,
              metadata: d.metadata ?? undefined
            }
          });

          if (hasCatalogChange(existing, role)) {
            await markAresSsoTenantChanged({ tenantOid: d.connection.tenantOid });
          }

          return (
            await this.syncConnectionRoleRoot({
              role,
              connection: d.connection,
              rootRole
            })
          ).role;
        }

        try {
          let role = await db.ssoConnectionRole.create({
            data: {
              ...getId('ssoConnectionRole'),
              connectionOid: d.connection.oid,
              rootRoleOid: rootRole.oid,
              value,
              displayName: d.displayName ?? null,
              metadata: d.metadata ?? undefined
            }
          });

          await markAresSsoTenantChanged({ tenantOid: d.connection.tenantOid });

          return (
            await this.syncConnectionRoleRoot({
              role,
              connection: d.connection,
              rootRole
            })
          ).role;
        } catch (error) {
          if (!isUniqueConstraintError(error)) throw error;

          let role = await db.ssoConnectionRole.findFirst({
            where: { connectionOid: d.connection.oid, value }
          });
          if (!role) throw error;

          return (
            await this.syncConnectionRoleRoot({
              role,
              connection: d.connection,
              rootRole
            })
          ).role;
        }
      },
      { ifExists: true }
    );
  }

  async getTenantCatalog(d: { tenant: SsoTenant | { oid: bigint } }) {
    let byIdAscending = { orderBy: { id: 'asc' } } as const;

    let [groups, roles, connectionGroups, connectionRoles] = await Promise.all([
      db.ssoGroup.findMany({ where: { tenantOid: d.tenant.oid }, ...byIdAscending }),
      db.ssoRole.findMany({ where: { tenantOid: d.tenant.oid }, ...byIdAscending }),
      db.ssoConnectionGroup.findMany({
        where: { connection: { tenantOid: d.tenant.oid } },
        include: { connection: { select: { id: true } }, rootGroup: { select: { id: true } } },
        ...byIdAscending
      }),
      db.ssoConnectionRole.findMany({
        where: { connection: { tenantOid: d.tenant.oid } },
        include: { connection: { select: { id: true } }, rootRole: { select: { id: true } } },
        ...byIdAscending
      })
    ]);

    let [directoryGroups, directoryRoles] = await Promise.all([
      db.ssoDirectoryGroup.findMany({
        where: { directory: { connection: { tenantOid: d.tenant.oid } } },
        include: { directory: { select: { id: true } }, group: { select: { id: true } } },
        ...byIdAscending
      }),
      db.ssoDirectoryRole.findMany({
        where: { directory: { connection: { tenantOid: d.tenant.oid } } },
        include: { directory: { select: { id: true } }, role: { select: { id: true } } },
        ...byIdAscending
      })
    ]);

    return {
      groups,
      roles,
      connectionGroups,
      connectionRoles,
      directoryGroups,
      directoryRoles
    };
  }

  async listRootGroups(d: {
    tenant: SsoTenant;
    filters?: {
      userIds?: string[];
      userProfileIds?: string[];
      connectionIds?: string[];
      directoryIds?: string[];
      groupIds?: string[];
    };
  }) {
    let where: Prisma.SsoGroupWhereInput = {
      tenantOid: d.tenant.oid,
      id: d.filters?.groupIds?.length ? { in: d.filters.groupIds } : undefined,
      connectionGroups: d.filters?.connectionIds?.length
        ? { some: { connection: { id: { in: d.filters.connectionIds } } } }
        : undefined,
      AND: [
        d.filters?.directoryIds?.length
          ? {
              connectionGroups: {
                some: {
                  directories: {
                    some: { directory: { id: { in: d.filters.directoryIds } } }
                  }
                }
              }
            }
          : undefined,
        d.filters?.userIds?.length
          ? {
              OR: [
                { users: { some: { user: { id: { in: d.filters.userIds } } } } },
                {
                  connectionGroups: {
                    some: {
                      userProfiles: {
                        some: { userProfile: { user: { id: { in: d.filters.userIds } } } }
                      }
                    }
                  }
                }
              ]
            }
          : undefined,
        d.filters?.userProfileIds?.length
          ? {
              connectionGroups: {
                some: {
                  userProfiles: {
                    some: { userProfile: { id: { in: d.filters.userProfileIds } } }
                  }
                }
              }
            }
          : undefined
      ].filter(Boolean) as Prisma.SsoGroupWhereInput[]
    };

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.ssoGroup.findMany({
            ...opts,
            where,
            include: ssoRootGroupInclude
          })
      )
    );
  }

  async getRootGroupById(d: { tenant: SsoTenant; groupId: string }) {
    let group = await db.ssoGroup.findFirst({
      where: { tenantOid: d.tenant.oid, id: d.groupId },
      include: ssoRootGroupInclude
    });
    if (!group) throw new ServiceError(notFoundError('sso.group'));
    return group;
  }

  async updateRootGroup(d: {
    tenant: SsoTenant;
    group: SsoGroup;
    input: { value?: string; displayName?: string | null; metadata?: Record<string, any> };
  }) {
    if (d.group.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('sso.group'));
    }

    return await withTransaction(async tdb => {
      let group = await tdb.ssoGroup.update({
        where: { oid: d.group.oid },
        data: {
          value: d.input.value,
          displayName: d.input.displayName !== undefined ? d.input.displayName : undefined,
          metadata: d.input.metadata
        },
        include: ssoRootGroupInclude
      });

      await markAresSsoTenantChanged({ tenantOid: d.tenant.oid });

      return group;
    });
  }

  async deleteRootGroup(d: { tenant: SsoTenant; group: SsoGroup }) {
    if (d.group.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('sso.group'));
    }

    return await withTransaction(async tdb => {
      let group = await tdb.ssoGroup.delete({
        where: { oid: d.group.oid },
        include: ssoRootGroupInclude
      });

      await markAresSsoTenantChanged({ tenantOid: d.tenant.oid });

      return group;
    });
  }

  async listRootRoles(d: {
    tenant: SsoTenant;
    filters?: {
      userIds?: string[];
      userProfileIds?: string[];
      connectionIds?: string[];
      directoryIds?: string[];
      roleIds?: string[];
    };
  }) {
    let where: Prisma.SsoRoleWhereInput = {
      tenantOid: d.tenant.oid,
      id: d.filters?.roleIds?.length ? { in: d.filters.roleIds } : undefined,
      connectionRoles: d.filters?.connectionIds?.length
        ? { some: { connection: { id: { in: d.filters.connectionIds } } } }
        : undefined,
      AND: [
        d.filters?.directoryIds?.length
          ? {
              connectionRoles: {
                some: {
                  directories: {
                    some: { directory: { id: { in: d.filters.directoryIds } } }
                  }
                }
              }
            }
          : undefined,
        d.filters?.userIds?.length
          ? {
              OR: [
                { users: { some: { user: { id: { in: d.filters.userIds } } } } },
                {
                  connectionRoles: {
                    some: {
                      userProfiles: {
                        some: { userProfile: { user: { id: { in: d.filters.userIds } } } }
                      }
                    }
                  }
                }
              ]
            }
          : undefined,
        d.filters?.userProfileIds?.length
          ? {
              connectionRoles: {
                some: {
                  userProfiles: {
                    some: { userProfile: { id: { in: d.filters.userProfileIds } } }
                  }
                }
              }
            }
          : undefined
      ].filter(Boolean) as Prisma.SsoRoleWhereInput[]
    };

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.ssoRole.findMany({
            ...opts,
            where,
            include: ssoRootRoleInclude
          })
      )
    );
  }

  async getRootRoleById(d: { tenant: SsoTenant; roleId: string }) {
    let role = await db.ssoRole.findFirst({
      where: { tenantOid: d.tenant.oid, id: d.roleId },
      include: ssoRootRoleInclude
    });
    if (!role) throw new ServiceError(notFoundError('sso.role'));
    return role;
  }

  async updateRootRole(d: {
    tenant: SsoTenant;
    role: SsoRole;
    input: { value?: string; displayName?: string | null; metadata?: Record<string, any> };
  }) {
    if (d.role.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('sso.role'));
    }

    return await withTransaction(async tdb => {
      let role = await tdb.ssoRole.update({
        where: { oid: d.role.oid },
        data: {
          value: d.input.value,
          displayName: d.input.displayName !== undefined ? d.input.displayName : undefined,
          metadata: d.input.metadata
        },
        include: ssoRootRoleInclude
      });

      await markAresSsoTenantChanged({ tenantOid: d.tenant.oid });

      return role;
    });
  }

  async deleteRootRole(d: { tenant: SsoTenant; role: SsoRole }) {
    if (d.role.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('sso.role'));
    }

    return await withTransaction(async tdb => {
      let role = await tdb.ssoRole.delete({
        where: { oid: d.role.oid },
        include: ssoRootRoleInclude
      });

      await markAresSsoTenantChanged({ tenantOid: d.tenant.oid });

      return role;
    });
  }

  async listConnectionGroups(d: {
    tenant: SsoTenant;
    filters?: {
      userIds?: string[];
      userProfileIds?: string[];
      connectionIds?: string[];
      groupIds?: string[];
    };
  }) {
    let where: Prisma.SsoConnectionGroupWhereInput = {
      connection: {
        tenantOid: d.tenant.oid,
        id: d.filters?.connectionIds?.length ? { in: d.filters.connectionIds } : undefined
      },
      AND: [
        d.filters?.groupIds?.length
          ? {
              OR: [
                { id: { in: d.filters.groupIds } },
                { rootGroup: { id: { in: d.filters.groupIds } } }
              ]
            }
          : undefined,
        d.filters?.userIds?.length
          ? {
              userProfiles: {
                some: { userProfile: { user: { id: { in: d.filters.userIds } } } }
              }
            }
          : undefined,
        d.filters?.userProfileIds?.length
          ? {
              userProfiles: {
                some: { userProfile: { id: { in: d.filters.userProfileIds } } }
              }
            }
          : undefined
      ].filter(Boolean) as Prisma.SsoConnectionGroupWhereInput[]
    };

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.ssoConnectionGroup.findMany({
            ...opts,
            where,
            include: ssoConnectionGroupInclude
          })
      )
    );
  }

  async getConnectionGroupById(d: { tenant: SsoTenant; groupId: string }) {
    let group = await db.ssoConnectionGroup.findFirst({
      where: { id: d.groupId, connection: { tenantOid: d.tenant.oid } },
      include: ssoConnectionGroupInclude
    });
    if (!group) throw new ServiceError(notFoundError('sso.connection_group'));
    return group;
  }

  async updateConnectionGroup(d: {
    tenant: SsoTenant;
    group: SsoConnectionGroup;
    input: { value?: string; displayName?: string | null; metadata?: Record<string, any> };
  }) {
    let connection = await db.ssoConnection.findFirst({
      where: { oid: d.group.connectionOid, tenantOid: d.tenant.oid }
    });
    if (!connection) throw new ServiceError(notFoundError('sso.connection_group'));

    let nextValue = d.input.value ?? d.group.value;
    let nextDisplayName =
      d.input.displayName !== undefined ? d.input.displayName : d.group.displayName;
    let nextMetadata =
      d.input.metadata !== undefined
        ? d.input.metadata
        : ((d.group.metadata as Record<string, any> | null) ?? undefined);

    let rootGroup = await this.upsertRootGroup({
      tenant: d.tenant,
      value: nextValue,
      displayName: nextDisplayName,
      metadata: nextMetadata
    });

    return await withTransaction(async tdb => {
      let group = await tdb.ssoConnectionGroup.update({
        where: { oid: d.group.oid },
        data: {
          value: d.input.value,
          displayName: d.input.displayName !== undefined ? d.input.displayName : undefined,
          metadata: d.input.metadata,
          rootGroupOid: rootGroup.oid
        },
        include: ssoConnectionGroupInclude
      });

      await markAresSsoTenantChanged({ tenantOid: d.tenant.oid });

      return group;
    });
  }

  async deleteConnectionGroup(d: { tenant: SsoTenant; group: SsoConnectionGroup }) {
    let existing = await this.getConnectionGroupById({
      tenant: d.tenant,
      groupId: d.group.id
    });

    return await withTransaction(async tdb => {
      let group = await tdb.ssoConnectionGroup.delete({
        where: { oid: existing.oid },
        include: ssoConnectionGroupInclude
      });

      await markAresSsoTenantChanged({ tenantOid: d.tenant.oid });

      return group;
    });
  }

  async listConnectionRoles(d: {
    tenant: SsoTenant;
    filters?: {
      userIds?: string[];
      userProfileIds?: string[];
      connectionIds?: string[];
      roleIds?: string[];
    };
  }) {
    let where: Prisma.SsoConnectionRoleWhereInput = {
      connection: {
        tenantOid: d.tenant.oid,
        id: d.filters?.connectionIds?.length ? { in: d.filters.connectionIds } : undefined
      },
      AND: [
        d.filters?.roleIds?.length
          ? {
              OR: [
                { id: { in: d.filters.roleIds } },
                { rootRole: { id: { in: d.filters.roleIds } } }
              ]
            }
          : undefined,
        d.filters?.userIds?.length
          ? {
              userProfiles: {
                some: { userProfile: { user: { id: { in: d.filters.userIds } } } }
              }
            }
          : undefined,
        d.filters?.userProfileIds?.length
          ? {
              userProfiles: {
                some: { userProfile: { id: { in: d.filters.userProfileIds } } }
              }
            }
          : undefined
      ].filter(Boolean) as Prisma.SsoConnectionRoleWhereInput[]
    };

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.ssoConnectionRole.findMany({
            ...opts,
            where,
            include: ssoConnectionRoleInclude
          })
      )
    );
  }

  async getConnectionRoleById(d: { tenant: SsoTenant; roleId: string }) {
    let role = await db.ssoConnectionRole.findFirst({
      where: { id: d.roleId, connection: { tenantOid: d.tenant.oid } },
      include: ssoConnectionRoleInclude
    });
    if (!role) throw new ServiceError(notFoundError('sso.connection_role'));
    return role;
  }

  async updateConnectionRole(d: {
    tenant: SsoTenant;
    role: SsoConnectionRole;
    input: { value?: string; displayName?: string | null; metadata?: Record<string, any> };
  }) {
    let connection = await db.ssoConnection.findFirst({
      where: { oid: d.role.connectionOid, tenantOid: d.tenant.oid }
    });
    if (!connection) throw new ServiceError(notFoundError('sso.connection_role'));

    let nextValue = d.input.value ?? d.role.value;
    let nextDisplayName =
      d.input.displayName !== undefined ? d.input.displayName : d.role.displayName;
    let nextMetadata =
      d.input.metadata !== undefined
        ? d.input.metadata
        : ((d.role.metadata as Record<string, any> | null) ?? undefined);

    let rootRole = await this.upsertRootRole({
      tenant: d.tenant,
      value: nextValue,
      displayName: nextDisplayName,
      metadata: nextMetadata
    });

    return await withTransaction(async tdb => {
      let role = await tdb.ssoConnectionRole.update({
        where: { oid: d.role.oid },
        data: {
          value: d.input.value,
          displayName: d.input.displayName !== undefined ? d.input.displayName : undefined,
          metadata: d.input.metadata,
          rootRoleOid: rootRole.oid
        },
        include: ssoConnectionRoleInclude
      });

      await markAresSsoTenantChanged({ tenantOid: d.tenant.oid });

      return role;
    });
  }

  async deleteConnectionRole(d: { tenant: SsoTenant; role: SsoConnectionRole }) {
    let existing = await this.getConnectionRoleById({
      tenant: d.tenant,
      roleId: d.role.id
    });

    return await withTransaction(async tdb => {
      let role = await tdb.ssoConnectionRole.delete({
        where: { oid: existing.oid },
        include: ssoConnectionRoleInclude
      });

      await markAresSsoTenantChanged({ tenantOid: d.tenant.oid });

      return role;
    });
  }

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
  }

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
  }

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
}

export let ssoGroupRoleService = Service.create(
  'SsoGroupRoleService',
  () => new SsoGroupRoleServiceImpl()
).build();
