import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';

let include = {
  tenant: true,
  repository: {
    include: {
      registry: true
    }
  }
};

class containerRepositoryVersionServiceImpl {
  async getRepositoryVersionById(d: { tenant: Tenant; repositoryVersionId: string }) {
    let repositoryVersion = await db.containerRepositoryVersion.findFirst({
      where: {
        id: d.repositoryVersionId,

        OR: [{ tenantOid: d.tenant.oid }, { tenantOid: null }]
      },
      include
    });
    if (!repositoryVersion) throw new ServiceError(notFoundError('repositoryVersion'));
    return repositoryVersion;
  }

  async listRepositoryVersions(d: { tenant: Tenant; repositories?: string[] }) {
    let repositories = d.repositories
      ? await db.containerRepository.findMany({
          where: {
            AND: [
              { id: { in: d.repositories } },
              { OR: [{ tenantOid: d.tenant.oid }, { tenantOid: null }] }
            ]
          },
          select: { oid: true }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.containerRepositoryVersion.findMany({
            ...opts,
            where: {
              repositoryOid: repositories ? { in: repositories.map(r => r.oid) } : undefined,
              OR: [{ tenantOid: d.tenant.oid }, { tenantOid: null }]
            },
            include
          })
      )
    );
  }
}

export let containerRepositoryVersionService = Service.create(
  'containerRepositoryVersionService',
  () => new containerRepositoryVersionServiceImpl()
).build();
