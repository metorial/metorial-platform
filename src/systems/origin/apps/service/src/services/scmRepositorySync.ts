import { badRequestError, notFoundError, ServiceError } from '@mtsrc/error';
import { Service } from '@mtsrc/service';
import type { CodeBucket, ScmRepository, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { startRepositorySyncQueue } from '../queues/scm/repositorySync/start';

class scmRepositorySyncServiceImpl {
  async getScmRepositorySyncById(d: { tenant: Tenant; id: string }) {
    let sync = await db.scmRepositorySync.findFirst({
      where: {
        id: d.id,
        tenantOid: d.tenant.oid
      }
    });

    if (!sync) throw new ServiceError(notFoundError('scmRepositorySync'));
    return sync;
  }

  async getManyScmRepositorySyncsByIds(d: { tenant: Tenant; ids: string[] }) {
    if (d.ids.length === 0) return [];

    return await db.scmRepositorySync.findMany({
      where: {
        tenantOid: d.tenant.oid,
        id: { in: d.ids }
      }
    });
  }

  async createScmRepositorySync(d: {
    tenant: Tenant;
    repo: ScmRepository;
    codeBucket: CodeBucket;
    branchName: string;
    prName: string;
    prDescription?: string;
    enableAutoMerge?: boolean;
  }) {
    let branchName = d.branchName.trim();
    let title = d.prName.trim();

    if (!branchName) {
      throw new ServiceError(badRequestError({ message: 'Branch name is required' }));
    }

    if (!title) {
      throw new ServiceError(badRequestError({ message: 'Pull request name is required' }));
    }

    if (d.repo.tenantOid !== d.tenant.oid || d.codeBucket.tenantOid !== d.tenant.oid) {
      throw new ServiceError(badRequestError({ message: 'Repository and code bucket must belong to the tenant' }));
    }

    let sync = await db.scmRepositorySync.create({
      data: {
        ...getId('scmRepositorySync'),
        tenantOid: d.tenant.oid,
        repoOid: d.repo.oid,
        codeBucketOid: d.codeBucket.oid,
        branchName,
        baseBranch: d.repo.defaultBranch ?? 'main',
        title,
        description: d.prDescription,
        enableAutoMerge: d.enableAutoMerge ?? true
      }
    });

    await startRepositorySyncQueue.add({ syncId: sync.id });

    return sync;
  }
}

export let scmRepositorySyncService = Service.create(
  'scmRepositorySyncService',
  () => new scmRepositorySyncServiceImpl()
).build();
