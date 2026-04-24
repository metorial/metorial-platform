import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { reconcileTenantManagedProviderAuthCredentialsBackings } from '../../lib/managedProviderAuthCredentialsBacking';

let RECONCILE_ALL_TENANTS_BATCH_SIZE = 100;

export let reconcileTenantManagedBackingsQueue = createQueue<{
  tenantId: string;
  solutionId: string;
}>({
  name: 'sub/auth/reconcile/mng/backings/tenant',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 5
  }
});

export let reconcileTenantManagedBackingsQueueProcessor =
  reconcileTenantManagedBackingsQueue.process(async data => {
    let tenant = await db.tenant.findUnique({
      where: {
        id: data.tenantId
      }
    });
    let solution = await db.solution.findUnique({
      where: {
        id: data.solutionId
      }
    });
    if (!tenant || !solution) return;

    await reconcileTenantManagedProviderAuthCredentialsBackings({
      tenant,
      solution
    });
  });

export let reconcileAllTenantsManagedBackingsQueue = createQueue<{
  solutionId: string;
  cursor?: string;
}>({
  name: 'sub/auth/reconcile/mng/backings/all',
  redisUrl: env.service.REDIS_URL
});

export let reconcileAllTenantsManagedBackingsQueueProcessor =
  reconcileAllTenantsManagedBackingsQueue.process(async data => {
    let tenants = await db.tenant.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: {
        id: 'asc'
      },
      take: RECONCILE_ALL_TENANTS_BATCH_SIZE,
      select: {
        id: true
      }
    });
    if (tenants.length === 0) return;

    await reconcileTenantManagedBackingsQueue.addManyWithOps(
      tenants.map(tenant => ({
        data: {
          tenantId: tenant.id,
          solutionId: data.solutionId
        },
        opts: {
          id: `tenant-${tenant.id}-${data.solutionId}`
        }
      }))
    );

    await reconcileAllTenantsManagedBackingsQueue.add({
      solutionId: data.solutionId,
      cursor: tenants[tenants.length - 1]!.id
    });
  });
