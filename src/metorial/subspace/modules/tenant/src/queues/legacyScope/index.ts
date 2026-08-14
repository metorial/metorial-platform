import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors } from '@lowerdeck/queue';
import { db as subspaceDb } from '@metorial-subspace/db';
import { env } from '../../env';
import {
  CANONICAL_ENVIRONMENT_PREFIX,
  CANONICAL_TENANT_PREFIX,
  resolveInstanceForEnvironment,
  resolveProjectForTenant
} from '../../lib/legacyScope';
import { reconcileLegacyScopeService } from '../../services/reconcileLegacyScope';
import {
  enqueueLegacyScopeRepair,
  reconcileLegacyScopeEnvironmentSearchQueue,
  reconcileLegacyScopeProjectQueue,
  reconcileLegacyScopeTenantSearchQueue
} from './queues';

let BATCH_SIZE = 500;

export * from './queues';

export let reconcileLegacyScopeCron = createCron(
  {
    name: 'sub/ten/legacy/scope/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '30 * * * *'
  },
  async () => {
    await reconcileLegacyScopeTenantSearchQueue.add(
      {},
      { id: 'subspace-legacy-scope-tenant-search' }
    );
    await reconcileLegacyScopeEnvironmentSearchQueue.add(
      {},
      { id: 'subspace-legacy-scope-environment-search' }
    );
  }
);

export let reconcileLegacyScopeTenantSearchQueueProcessor =
  reconcileLegacyScopeTenantSearchQueue.process(async data => {
    let tenants = await subspaceDb.tenant.findMany({
      where: {
        retiredAt: null,
        NOT: { identifier: { startsWith: CANONICAL_TENANT_PREFIX } },
        oid: data.cursor ? { gt: BigInt(data.cursor) } : undefined
      },
      orderBy: { oid: 'asc' },
      take: BATCH_SIZE,
      select: {
        oid: true,
        id: true,
        identifier: true,
        resourceTenantIdentifier: true,
        projectOid: true
      }
    });
    if (tenants.length === 0) return;

    for (let tenant of tenants) {
      let resolution = await resolveProjectForTenant(tenant);

      if (resolution.status === 'unresolved') {
        console.warn(`[subspace] legacy tenant not reconciled: ${resolution.reason}`);
        continue;
      }

      await enqueueLegacyScopeRepair({ projectOid: resolution.value });
    }

    let lastTenant = tenants[tenants.length - 1];
    if (!lastTenant) return;

    await reconcileLegacyScopeTenantSearchQueue.add({ cursor: lastTenant.oid.toString() });
  });

export let reconcileLegacyScopeEnvironmentSearchQueueProcessor =
  reconcileLegacyScopeEnvironmentSearchQueue.process(async data => {
    let environments = await subspaceDb.environment.findMany({
      where: {
        NOT: { identifier: { startsWith: CANONICAL_ENVIRONMENT_PREFIX } },
        oid: data.cursor ? { gt: BigInt(data.cursor) } : undefined
      },
      orderBy: { oid: 'asc' },
      take: BATCH_SIZE,
      select: {
        oid: true,
        id: true,
        identifier: true,
        resourceGroupIdentifier: true,
        instanceOid: true
      }
    });
    if (environments.length === 0) return;

    for (let environment of environments) {
      let resolution = await resolveInstanceForEnvironment(environment);

      if (resolution.status === 'unresolved') {
        console.warn(`[subspace] legacy environment not reconciled: ${resolution.reason}`);
        continue;
      }

      await enqueueLegacyScopeRepair({ projectOid: resolution.value.projectOid });
    }

    let lastEnvironment = environments[environments.length - 1];
    if (!lastEnvironment) return;

    await reconcileLegacyScopeEnvironmentSearchQueue.add({
      cursor: lastEnvironment.oid.toString()
    });
  });

export let reconcileLegacyScopeProjectQueueProcessor =
  reconcileLegacyScopeProjectQueue.process(async data => {
    let report = await reconcileLegacyScopeService.reconcileLegacyProjectScope({
      projectOid: BigInt(data.projectOid)
    });

    if (report.status === 'aborted') {
      console.error(
        `[subspace] legacy scope reconcile aborted for project ${report.projectOid}: ${report.reason}`
      );
      return;
    }

    if (report.status === 'noop') {
      if (report.warnings.length > 0) {
        console.warn(
          `[subspace] legacy scope left project ${report.projectOid} untouched: ${report.warnings.join('; ')}`
        );
      }
      return;
    }

    if (report.warnings.length > 0) {
      console.warn(
        `[subspace] legacy scope reconciled project ${report.projectOid} with warnings: ${report.warnings.join('; ')}`,
        report
      );
      return;
    }

    console.log(`[subspace] legacy scope reconciled`, report);
  });

export let legacyScopeQueues = combineQueueProcessors([
  reconcileLegacyScopeCron,
  reconcileLegacyScopeTenantSearchQueueProcessor,
  reconcileLegacyScopeEnvironmentSearchQueueProcessor,
  reconcileLegacyScopeProjectQueueProcessor
]);
