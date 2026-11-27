import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../env';
import { publicMcpServerGrantService } from '../services/publicMcpServerGrant';

let REVOKE_BATCH_SIZE = 500;

export let publicMcpServerArchivedQueue = createQueue<{
  publicMcpServerId: string;
  cursor?: string;
}>({
  name: 'sub/pmcp/server/archived',
  workerOpts: { concurrency: 1 },
  redisUrl: env.service.REDIS_URL
});

export let publicMcpServerArchivedQueueProcessor = publicMcpServerArchivedQueue.process(
  async data => {
    let publicMcpServer = await db.publicMcpServer.findUnique({
      where: { id: data.publicMcpServerId },
      select: { oid: true, status: true }
    });
    if (!publicMcpServer || publicMcpServer.status !== 'archived') return;

    if (!data.cursor) {
      await db.publicMcpServerAuthorization.updateMany({
        where: {
          publicMcpServerOid: publicMcpServer.oid,
          status: { in: ['pending', 'setup', 'code_issued'] }
        },
        data: { status: 'expired' }
      });
    }

    let grants = await db.publicMcpServerGrant.findMany({
      where: {
        publicMcpServerOid: publicMcpServer.oid,
        status: { in: ['active', 'pending_exchange'] },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: REVOKE_BATCH_SIZE,
      select: { id: true }
    });
    if (grants.length === 0) return;

    await publicMcpServerGrantRevokeQueue.addManyWithOps(
      grants.map(grant => ({
        data: { grantId: grant.id },
        opts: { id: `archived-${grant.id}` }
      }))
    );

    if (grants.length === REVOKE_BATCH_SIZE) {
      await publicMcpServerArchivedQueue.add(
        { publicMcpServerId: data.publicMcpServerId, cursor: grants[grants.length - 1]!.id },
        hourlyPacedDelay()
      );
    }
  }
);

let publicMcpServerGrantRevokeQueue = createQueue<{ grantId: string }>({
  name: 'sub/pmcp/server/archived/revoke',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } },
  redisUrl: env.service.REDIS_URL
});

let publicMcpServerGrantRevokeQueueProcessor = publicMcpServerGrantRevokeQueue.process(
  async data => {
    let grant = await db.publicMcpServerGrant.findUnique({ where: { id: data.grantId } });
    if (!grant || (grant.status !== 'active' && grant.status !== 'pending_exchange')) return;

    await publicMcpServerGrantService.revokeGrantInternal({
      grant,
      reason: 'server_archived'
    });
  }
);

export let publicMcpServerArchivedProcessors = combineQueueProcessors([
  publicMcpServerArchivedQueueProcessor,
  publicMcpServerGrantRevokeQueueProcessor
]);
