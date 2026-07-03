import type { DirectoryType } from '@boxyhq/saml-jackson';
import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  Prisma,
  SsoConnection,
  SsoDirectory,
  SsoDirectoryStatus,
  SsoTenant
} from '../../../prisma/generated/client';
import { db } from '../../db';
import { getId } from '../../id';
import { jackson } from '../../lib/jackson';
import { enqueueDisableSsoDirectoryUsers } from '../../queues/disableSsoDirectoryUsers';

let ssoDirectoryInclude = {
  connection: {
    include: {
      tenant: true
    }
  },
  userProfiles: {
    include: {
      userProfile: true
    }
  }
} satisfies Prisma.SsoDirectoryInclude;

class SsoDirectoryServiceImpl {
  async createDirectory(d: {
    tenant: SsoTenant;
    connection: SsoConnection;
    input: {
      name: string;
      type: DirectoryType;
      metadata?: Record<string, any>;
    };
  }) {
    if (d.connection.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('sso.connection'));
    }
    if (d.connection.status !== 'active') {
      throw new ServiceError(badRequestError({ message: 'Connection is disabled' }));
    }

    let res = await jackson.directorySyncController.directories.create({
      name: d.input.name,
      type: d.input.type,
      tenant: d.connection.internalId,
      product: 'metorial'
    });

    if (res.error || !res.data) {
      throw new ServiceError(
        badRequestError({
          message: `Could not create SCIM directory: ${res.error ?? 'unknown error'}`
        })
      );
    }

    let directory = await db.ssoDirectory.create({
      data: {
        ...getId('ssoDirectory'),
        connectionOid: d.connection.oid,
        internalId: res.data.id,
        name: res.data.name ?? d.input.name,
        type: res.data.type ?? d.input.type,
        scimPath: res.data.scim?.path ?? `/sso/scim/${res.data.id}`,
        scimEndpoint: res.data.scim?.endpoint ?? '',
        scimSecret: res.data.scim?.secret ?? '',
        metadata: d.input.metadata ?? undefined
      },
      include: ssoDirectoryInclude
    });

    return {
      directory,
      scim: {
        path: res.data.scim?.path,
        endpoint: res.data.scim?.endpoint,
        secret: res.data.scim?.secret
      }
    };
  }

  async listDirectories(d: {
    tenant?: SsoTenant;
    connection?: SsoConnection;
    filters?: {
      userIds?: string[];
      userProfileIds?: string[];
      connectionIds?: string[];
      groupIds?: string[];
      roleIds?: string[];
      directoryIds?: string[];
      statuses?: string[];
    };
  }) {
    let where: Prisma.SsoDirectoryWhereInput = {
      id: d.filters?.directoryIds?.length ? { in: d.filters.directoryIds } : undefined,
      status: d.filters?.statuses?.length
        ? { in: d.filters.statuses as SsoDirectoryStatus[] }
        : undefined,
      connectionOid: d.connection?.oid,
      connection: {
        tenantOid: d.tenant?.oid,
        id: d.filters?.connectionIds?.length ? { in: d.filters.connectionIds } : undefined
      },
      userProfiles:
        d.filters?.userIds?.length || d.filters?.userProfileIds?.length
          ? {
              some: {
                userProfile: {
                  id: d.filters?.userProfileIds?.length
                    ? { in: d.filters.userProfileIds }
                    : undefined,
                  user: d.filters?.userIds?.length
                    ? { id: { in: d.filters.userIds } }
                    : undefined
                }
              }
            }
          : undefined
    };

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.ssoDirectory.findMany({
            ...opts,
            where,
            include: ssoDirectoryInclude
          })
      )
    );
  }

  async getDirectoryById(d: {
    tenant: SsoTenant;
    connection: SsoConnection;
    directoryId: string;
  }) {
    let directory = await db.ssoDirectory.findFirst({
      where: {
        id: d.directoryId,
        connectionOid: d.connection.oid,
        connection: { tenantOid: d.tenant.oid }
      },
      include: ssoDirectoryInclude
    });
    if (!directory) throw new ServiceError(notFoundError('sso.directory'));
    return directory;
  }

  async getTenantDirectoryById(d: { tenant: SsoTenant; directoryId: string }) {
    let directory = await db.ssoDirectory.findFirst({
      where: {
        id: d.directoryId,
        connection: { tenantOid: d.tenant.oid }
      },
      include: ssoDirectoryInclude
    });
    if (!directory) throw new ServiceError(notFoundError('sso.directory'));
    return directory;
  }

  async getDirectoryByInternalId(d: { internalId: string }) {
    let directory = await db.ssoDirectory.findFirst({
      where: {
        internalId: d.internalId,
        status: 'active',
        connection: { status: 'active' }
      },
      include: { connection: { include: { tenant: true } } }
    });
    if (!directory) throw new ServiceError(notFoundError('sso.directory'));
    return directory;
  }

  async updateDirectory(d: {
    tenant: SsoTenant;
    directory: SsoDirectory;
    input: {
      name?: string;
      metadata?: Record<string, any>;
      status?: SsoDirectoryStatus;
    };
  }) {
    let existing = await this.getTenantDirectoryById({
      tenant: d.tenant,
      directoryId: d.directory.id
    });

    if (d.input.status && d.input.status !== existing.status) {
      return await this.setDirectoryStatus({
        tenant: d.tenant,
        connection: existing.connection,
        directory: existing,
        status: d.input.status
      });
    }

    return await db.ssoDirectory.update({
      where: { oid: existing.oid },
      data: {
        name: d.input.name,
        metadata: d.input.metadata
      },
      include: ssoDirectoryInclude
    });
  }

  async setDirectoryStatus(d: {
    tenant: SsoTenant;
    connection: SsoConnection;
    directory: SsoDirectory;
    status: SsoDirectoryStatus;
  }) {
    if (
      d.connection.tenantOid !== d.tenant.oid ||
      d.directory.connectionOid !== d.connection.oid
    ) {
      throw new ServiceError(notFoundError('sso.directory'));
    }

    if (d.status === 'active' && d.directory.status === 'disabled') {
      throw new ServiceError(
        badRequestError({ message: 'Disabled directories cannot be reactivated' })
      );
    }

    let directory = await db.ssoDirectory.update({
      where: { oid: d.directory.oid },
      data: { status: d.status },
      include: ssoDirectoryInclude
    });

    if (d.status === 'disabled' && d.directory.status !== 'disabled') {
      await enqueueDisableSsoDirectoryUsers({
        directoryId: directory.id
      });
    }

    return directory;
  }

  async deleteDirectory(d: { tenant: SsoTenant; directory: SsoDirectory }) {
    let existing = await this.getTenantDirectoryById({
      tenant: d.tenant,
      directoryId: d.directory.id
    });

    return await this.setDirectoryStatus({
      tenant: d.tenant,
      connection: existing.connection,
      directory: existing,
      status: 'disabled'
    });
  }
}

export let ssoDirectoryService = Service.create(
  'SsoDirectoryService',
  () => new SsoDirectoryServiceImpl()
).build();
