import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import { db, type Environment, type Solution, type Tenant } from '@metorial-subspace/db';
import { type DateFilter, normalizeDateFilter, resolveScmRepos } from '@metorial-subspace/list-utils';

let include = { repo: true };

class scmPushServiceImpl {
  async listScmPushes(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    createdAt?: DateFilter;
    updatedAt?: DateFilter;

    ids?: string[];
    scmRepoIds?: string[];
  }) {
    let repos = await resolveScmRepos(d, d.scmRepoIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.scmRepoPush.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                repos ? { repoOid: repos.in } : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getScmPushById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    scmPushId: string;
  }) {
    let scmRepoPush = await db.scmRepoPush.findFirst({
      where: {
        id: d.scmPushId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid
      },
      include
    });
    if (!scmRepoPush) throw new ServiceError(notFoundError('scm.repository', d.scmPushId));

    return scmRepoPush;
  }
}

export let scmPushService = Service.create('scmPush', () => new scmPushServiceImpl()).build();
