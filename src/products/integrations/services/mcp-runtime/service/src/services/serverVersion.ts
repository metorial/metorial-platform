import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';

let include = {
  server: true,
  tenant: true,

  deployment: true,

  repositoryTag: {
    include: {
      tenant: true,
      currentVersion: true,
      repository: {
        include: { registry: true }
      }
    }
  },
  repositoryVersion: {
    include: {
      tenant: true,
      repository: {
        include: { registry: true }
      }
    }
  }
};

class serverVersionServiceImpl {
  async getServerVersionById(d: { tenant: Tenant; serverVersionId: string }) {
    let serverVersion = await db.serverVersion.findFirst({
      where: {
        id: d.serverVersionId,
        OR: [{ tenantOid: d.tenant.oid }, { tenantOid: null }]
      },
      include
    });
    if (!serverVersion) throw new ServiceError(notFoundError('server_version'));
    return serverVersion;
  }

  async listServerVersions(d: { tenant: Tenant; serverIds?: string[] }) {
    let servers = d.serverIds
      ? await db.server.findMany({
          where: {
            OR: [{ tenantOid: d.tenant.oid }, { tenantOid: null }],
            id: { in: d.serverIds }
          },
          select: { oid: true }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.serverVersion.findMany({
            ...opts,
            where: {
              OR: [{ tenantOid: d.tenant.oid }, { tenantOid: null }],
              serverOid: servers ? { in: servers.map(s => s.oid) } : undefined
            },
            include
          })
      )
    );
  }

  async getManyServerVersionsByIds(d: { tenant?: Tenant; serverVersionIds: string[] }) {
    return await db.serverVersion.findMany({
      where: {
        id: { in: d.serverVersionIds },
        OR: d.tenant ? [{ tenantOid: d.tenant.oid }, { tenantOid: null }] : undefined
      },
      include
    });
  }
}

export let serverVersionService = Service.create(
  'serverVersionService',
  () => new serverVersionServiceImpl()
).build();
