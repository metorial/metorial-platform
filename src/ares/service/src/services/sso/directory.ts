import type { DirectoryType } from '@boxyhq/saml-jackson';
import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import type {
  SsoConnection,
  SsoDirectory,
  SsoDirectoryStatus,
  SsoTenant
} from '../../../prisma/generated/client';
import { db } from '../../db';
import { getId } from '../../id';
import { jackson } from '../../lib/jackson';

export let ssoDirectoryService = {
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
      }
    });

    return {
      directory,
      scim: {
        endpoint: res.data.scim?.endpoint,
        secret: res.data.scim?.secret
      }
    };
  },

  async listDirectories(d: { connection: SsoConnection }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.ssoDirectory.findMany({
            ...opts,
            where: { connectionOid: d.connection.oid }
          })
      )
    );
  },

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
      }
    });
    if (!directory) throw new ServiceError(notFoundError('sso.directory'));
    return directory;
  },

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
  },

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

    if (d.status === 'disabled') {
      await db.ssoUserProfile.updateMany({
        where: {
          directories: { some: { directoryOid: d.directory.oid } }
        },
        data: { status: 'deprovisioned' }
      });

      await db.ssoUserProfile.updateMany({
        where: { ownerDirectoryOid: d.directory.oid },
        data: { ownerDirectoryOid: null }
      });
    }

    return await db.ssoDirectory.update({
      where: { oid: d.directory.oid },
      data: { status: d.status }
    });
  }
};
