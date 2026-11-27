import { createCron } from '@lowerdeck/cron';
import {
  combineQueueProcessors,
  createQueue,
  dailyPacedDelay,
  deleteInChunks
} from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { subDays } from 'date-fns';
import { env } from '../env';
import { publicMcpServerGrantService } from '../services/publicMcpServerGrant';

let EXPIRE_BATCH_SIZE = 500;
let TOKEN_PRUNE_BATCH_SIZE = 500;
let TOKEN_RETENTION_DAYS = 7;

let expireAuthorizationsCron = createCron(
  {
    name: 'sub/pmcp/authorization/expire',
    cron: '* * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await db.publicMcpServerAuthorization.updateMany({
      where: {
        status: { in: ['pending', 'setup', 'code_issued'] },
        expiresAt: { lte: new Date() }
      },
      data: { status: 'expired' }
    });
  }
);

let expireGrantsCron = createCron(
  {
    name: 'sub/pmcp/grant/expire',
    cron: '* * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    let grants = await db.publicMcpServerGrant.findMany({
      where: {
        status: { in: ['active', 'pending_exchange'] },
        expiresAt: { lte: new Date() }
      },
      orderBy: { id: 'asc' },
      take: EXPIRE_BATCH_SIZE,
      select: { id: true }
    });
    if (grants.length === 0) return;

    await expireGrantSingleQueue.addManyWithOps(
      grants.map(grant => ({
        data: { grantId: grant.id },
        opts: { id: `expire-${grant.id}` }
      }))
    );
  }
);

let expireGrantSingleQueue = createQueue<{ grantId: string }>({
  name: 'sub/pmcp/grant/expire/single',
  workerOpts: { concurrency: 5 },
  redisUrl: env.service.REDIS_URL
});

let expireGrantSingleQueueProcessor = expireGrantSingleQueue.process(async data => {
  let grant = await db.publicMcpServerGrant.findUnique({ where: { id: data.grantId } });
  if (!grant || grant.expiresAt > new Date()) return;
  if (grant.status !== 'active' && grant.status !== 'pending_exchange') return;

  await publicMcpServerGrantService.revokeGrantInternal({
    grant,
    reason: grant.status === 'pending_exchange' ? 'exchange_expired' : 'idle_expired'
  });
});

let pruneTokensCron = createCron(
  {
    name: 'sub/pmcp/token/prune',
    cron: '0 3 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await pruneTokensQueue.add({});
  }
);

let pruneTokensQueue = createQueue<{}>({
  name: 'sub/pmcp/token/prune/many',
  workerOpts: { concurrency: 1 },
  redisUrl: env.service.REDIS_URL
});

let pruneTokensQueueProcessor = pruneTokensQueue.process(async () => {
  let where = { expiresAt: { lte: subDays(new Date(), TOKEN_RETENTION_DAYS) } };

  let { hasMore } = await deleteInChunks({
    chunkSize: TOKEN_PRUNE_BATCH_SIZE,
    selectKeys: take =>
      db.publicMcpServerToken.findMany({ where, take, select: { oid: true } }),
    deleteKeys: keys =>
      db.publicMcpServerToken.deleteMany({ where: { oid: { in: keys.map(k => k.oid) } } })
  });

  if (hasMore) await pruneTokensQueue.add({}, dailyPacedDelay());
});

export let publicMcpExpireProcessors = combineQueueProcessors([
  expireAuthorizationsCron,
  expireGrantsCron,
  expireGrantSingleQueueProcessor,
  pruneTokensCron,
  pruneTokensQueueProcessor
]);
