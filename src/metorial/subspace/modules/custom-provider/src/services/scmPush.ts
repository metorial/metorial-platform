import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Environment, type Tenant } from '@metorial-subspace/db';
import { type DateFilter, normalizeDateFilter, resolveScmRepos } from '@metorial-subspace/list-utils';
import { getMetorialSolution } from '@metorial-subspace/module-tenant';

let include = { repo: true };

class scmPushServiceImpl {
  async listScmPushes(d: {
    tenant: Tenant;
    environment: Environment;

    createdAt?: DateFilter;
    updatedAt?: DateFilter;

    ids?: string[];
    scmRepoIds?: string[];
  }) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let repos = await resolveScmRepos(ts, d.scmRepoIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.scmRepoPush.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,

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

  async getScmPushById(d: { tenant: Tenant; environment: Environment; scmPushId: string }) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let scmRepoPush = await db.scmRepoPush.findFirst({
      where: {
        id: d.scmPushId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid
      },
      include
    });
    if (!scmRepoPush) throw new ServiceError(notFoundError('scm.repository', d.scmPushId));

    return scmRepoPush;
  }
}

export let scmPushService = Service.create('scmPush', () => new scmPushServiceImpl()).build();
