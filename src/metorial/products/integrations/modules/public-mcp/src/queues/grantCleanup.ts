import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { providerAuthConfigService } from '@metorial-subspace/module-auth';
import { providerConfigService } from '@metorial-subspace/module-deployment';
import { sessionService } from '@metorial-subspace/module-session';
import { runWithPublicMcpAccess } from '@metorial-subspace/public-mcp-guard';
import { env } from '../env';

let CLEANUP_BATCH_SIZE = 500;

let isLive = (status: string) => status !== 'archived' && status !== 'deleted';

export let publicMcpGrantCleanupQueue = createQueue<{ grantId: string }>({
  name: 'sub/pmcp/grant/cleanup',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } },
  redisUrl: env.service.REDIS_URL
});

export let publicMcpGrantCleanupQueueProcessor = publicMcpGrantCleanupQueue.process(
  async data => {
    let grant = await db.publicMcpServerGrant.findUnique({
      where: { id: data.grantId },
      include: {
        tenant: true,
        environment: true,
        currentSession: true,
        config: true,
        authConfig: true
      }
    });
    if (!grant || grant.isCleanedUp) return;
    if (grant.status !== 'revoked' && grant.status !== 'expired') return;

    await runWithPublicMcpAccess(
      { publicMcpServerOid: grant.publicMcpServerOid, grantOid: grant.oid },
      async () => {
        let scope = { tenant: grant.tenant, environment: grant.environment };

        if (grant.currentSession && isLive(grant.currentSession.status)) {
          await sessionService.archiveSessionInternal({
            ...scope,
            session: grant.currentSession
          });
        }

        if (
          grant.authConfig &&
          grant.authConfig.ownerPublicMcpServerOid === grant.publicMcpServerOid &&
          isLive(grant.authConfig.status)
        ) {
          await providerAuthConfigService.archiveProviderAuthConfigInternal({
            ...scope,
            providerAuthConfig: grant.authConfig,
            _canArchiveOwned: true
          });
        }

        if (
          grant.config &&
          grant.config.ownerPublicMcpServerOid === grant.publicMcpServerOid &&
          isLive(grant.config.status)
        ) {
          await providerConfigService.archiveProviderConfigInternal({
            ...scope,
            providerConfig: grant.config,
            _canArchiveOwned: true
          });
        }
      }
    );

    await db.publicMcpServerGrant.update({
      where: { oid: grant.oid },
      data: { isCleanedUp: true }
    });
  }
);

export let publicMcpGrantCleanupManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/pmcp/grant/cleanup/many',
  workerOpts: { concurrency: 1 },
  redisUrl: env.service.REDIS_URL
});

export let publicMcpGrantCleanupManyQueueProcessor = publicMcpGrantCleanupManyQueue.process(
  async data => {
    let grants = await db.publicMcpServerGrant.findMany({
      where: {
        status: { in: ['revoked', 'expired'] },
        isCleanedUp: false,
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: CLEANUP_BATCH_SIZE,
      select: { id: true }
    });
    if (grants.length === 0) return;

    await publicMcpGrantCleanupQueue.addManyWithOps(
      grants.map(grant => ({ data: { grantId: grant.id }, opts: { id: grant.id } }))
    );

    if (grants.length === CLEANUP_BATCH_SIZE) {
      await publicMcpGrantCleanupManyQueue.add(
        { cursor: grants[grants.length - 1]!.id },
        hourlyPacedDelay()
      );
    }
  }
);

let publicMcpGrantCleanupCron = createCron(
  {
    name: 'sub/pmcp/grant/cleanup/cron',
    cron: '0 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await publicMcpGrantCleanupManyQueue.add({});
  }
);

export let publicMcpGrantCleanupProcessors = combineQueueProcessors([
  publicMcpGrantCleanupCron,
  publicMcpGrantCleanupManyQueueProcessor,
  publicMcpGrantCleanupQueueProcessor
]);
