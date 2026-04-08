import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';

class ScmRepoPushServiceImpl {
  async getScmRepoPushById(d: { tenant: Tenant; scmRepoPushId: string }) {
    let push = await db.scmRepositoryPush.findFirst({
      where: {
        id: d.scmRepoPushId,
        tenantOid: d.tenant.oid
      },
      include: {
        repo: { include: { account: true } }
      }
    });
    if (!push) throw new ServiceError(notFoundError('scm_repository_push', d.scmRepoPushId));

    return push;
  }

  async listScmRepoPushes(d: { tenant: Tenant; repoId?: string }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.scmRepositoryPush.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            ...(d.repoId && {
              repo: {
                id: d.repoId
              }
            })
          },
          include: {
            repo: { include: { account: true } }
          },
          orderBy: {
            createdAt: 'desc'
          }
        })
      )
    );
  }
}

export let scmRepoPushService = Service.create(
  'scmRepoPushService',
  () => new ScmRepoPushServiceImpl()
).build();
