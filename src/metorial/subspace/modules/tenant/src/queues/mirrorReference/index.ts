import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { db as subspaceDb } from '@metorial-subspace/db';
import { env } from '../../env';
import { backfillMirrorReferencesService } from '../../services/backfillMirrorReferences';

let BATCH_SIZE = 500;

export let backfillMirrorReferencesTenantQueue = createQueue<{ tenantOid: string }>({
  name: 'sub/ten/mirror/tenant',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 3 }
});

export let backfillMirrorReferencesEnvironmentQueue = createQueue<{ environmentOid: string }>({
  name: 'sub/ten/mirror/environment',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 3 }
});

export let backfillMirrorReferencesTenantSearchQueue = createQueue<{ cursor?: string }>({
  name: 'sub/ten/mirror/tenant/search',
  redisUrl: env.service.REDIS_URL
});

export let backfillMirrorReferencesEnvironmentSearchQueue = createQueue<{ cursor?: string }>({
  name: 'sub/ten/mirror/environment/search',
  redisUrl: env.service.REDIS_URL
});

export let backfillMirrorReferencesCron = createCron(
  {
    name: 'sub/ten/mirror/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '*/15 * * * *'
  },
  async () => {
    await backfillMirrorReferencesTenantSearchQueue.add(
      {},
      { id: 'subspace-mirror-reference-tenant-search' }
    );
    await backfillMirrorReferencesEnvironmentSearchQueue.add(
      {},
      { id: 'subspace-mirror-reference-environment-search' }
    );
  }
);

export let backfillMirrorReferencesTenantSearchQueueProcessor =
  backfillMirrorReferencesTenantSearchQueue.process(async data => {
    let tenants = await subspaceDb.tenant.findMany({
      where: {
        projectOid: { not: null },
        oid: data.cursor ? { gt: BigInt(data.cursor) } : undefined
      },
      orderBy: {
        oid: 'asc'
      },
      take: BATCH_SIZE,
      select: {
        oid: true
      }
    });
    if (tenants.length === 0) return;

    await backfillMirrorReferencesTenantQueue.addMany(
      tenants.map(tenant => ({
        tenantOid: tenant.oid.toString()
      }))
    );

    let lastTenant = tenants[tenants.length - 1];
    if (!lastTenant) return;

    await backfillMirrorReferencesTenantSearchQueue.add({
      cursor: lastTenant.oid.toString()
    });
  });

export let backfillMirrorReferencesEnvironmentSearchQueueProcessor =
  backfillMirrorReferencesEnvironmentSearchQueue.process(async data => {
    let environments = await subspaceDb.environment.findMany({
      where: {
        instanceOid: { not: null },
        oid: data.cursor ? { gt: BigInt(data.cursor) } : undefined
      },
      orderBy: {
        oid: 'asc'
      },
      take: BATCH_SIZE,
      select: {
        oid: true
      }
    });
    if (environments.length === 0) return;

    await backfillMirrorReferencesEnvironmentQueue.addMany(
      environments.map(environment => ({
        environmentOid: environment.oid.toString()
      }))
    );

    let lastEnvironment = environments[environments.length - 1];
    if (!lastEnvironment) return;

    await backfillMirrorReferencesEnvironmentSearchQueue.add({
      cursor: lastEnvironment.oid.toString()
    });
  });

export let backfillMirrorReferencesTenantQueueProcessor =
  backfillMirrorReferencesTenantQueue.process(async data => {
    await backfillMirrorReferencesService.backfillTenantReferences({
      tenantOid: BigInt(data.tenantOid)
    });
  });

export let backfillMirrorReferencesEnvironmentQueueProcessor =
  backfillMirrorReferencesEnvironmentQueue.process(async data => {
    await backfillMirrorReferencesService.backfillEnvironmentReferences({
      environmentOid: BigInt(data.environmentOid)
    });
  });

export let mirrorReferenceQueues = combineQueueProcessors([
  backfillMirrorReferencesCron,
  backfillMirrorReferencesTenantSearchQueueProcessor,
  backfillMirrorReferencesEnvironmentSearchQueueProcessor,
  backfillMirrorReferencesTenantQueueProcessor,
  backfillMirrorReferencesEnvironmentQueueProcessor
]);
