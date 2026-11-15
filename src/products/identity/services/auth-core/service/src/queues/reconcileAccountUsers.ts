import { combineQueueProcessors, createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db, withTransaction } from '../db';
import { env } from '../env';

export let reconcileAccountUsersQueue = createQueue<{
  operationId: string;
  accountId?: string;
  appId?: string;
  domain?: string;
  cursor?: string;
}>({
  name: 'ares/account/user/reconcileMany',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let reconcileSingleAccountUserQueue = createQueue<{
  operationId: string;
  userId: string;
}>({
  name: 'ares/account/user/reconcileSingle',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 10 }
});

export let finalizeAccountDeleteQueue = createQueue<{
  accountId: string;
}>({
  name: 'ares/account/deleteFinalize',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let enqueueReconcileAccountUsers = async (d: {
  accountId?: string;
  appId?: string;
  domain?: string;
}) => {
  let operationId = crypto.randomUUID();
  await reconcileAccountUsersQueue.addManyWithOps([
    {
      data: {
        operationId,
        accountId: d.accountId,
        appId: d.appId,
        domain: d.domain
      },
      opts: { id: operationId }
    }
  ]);
};

export let reconcileAccountUsersQueueProcessor = reconcileAccountUsersQueue.process(
  async data => {
    if (!data.accountId && !data.domain) return;
    let account = data.accountId
      ? await db.account.findUnique({ where: { id: data.accountId } })
      : null;
    if (data.accountId && !account) return;
    let app = data.appId ? await db.app.findUnique({ where: { id: data.appId } }) : null;
    if (data.appId && !app) return;

    let users = await db.user.findMany({
      where: {
        appOid: app?.oid,
        id: data.cursor ? { gt: data.cursor } : undefined,
        OR: [
          ...(account ? [{ accountOid: account.oid }] : []),
          ...(data.domain ? [{ email: { endsWith: `@${data.domain}` } }] : [])
        ]
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: 500
    });

    if (users.length === 0) {
      if (account?.status === 'deleting') {
        await finalizeAccountDeleteQueue.addManyWithOps([
          {
            data: { accountId: account.id },
            opts: { id: data.operationId }
          }
        ]);
      }
      return;
    }

    await reconcileSingleAccountUserQueue.addManyWithOps(
      users.map(user => ({
        data: { operationId: data.operationId, userId: user.id },
        opts: { id: `${data.operationId}--${user.id}` }
      }))
    );

    let cursor = users[users.length - 1]!.id;
    await reconcileAccountUsersQueue.add(
      {
        operationId: data.operationId,
        accountId: data.accountId,
        appId: data.appId,
        domain: data.domain,
        cursor
      },
      { id: `${data.operationId}--page--${cursor}` }
    );
  }
);

export let reconcileSingleAccountUserQueueProcessor = reconcileSingleAccountUserQueue.process(
  async data => {
    let user = await db.user.findUnique({ where: { id: data.userId } });
    if (!user) return;

    let separator = user.email.lastIndexOf('@');
    let domain = separator === -1 ? null : user.email.slice(separator + 1).toLowerCase();
    let accountDomain = domain
      ? await db.accountDomain.findUnique({
          where: {
            appOid_domain: {
              appOid: user.appOid,
              domain
            }
          },
          include: { account: true }
        })
      : null;
    let accountOid =
      accountDomain?.account.status === 'active' ? accountDomain.accountOid : null;

    if (user.accountOid === accountOid) return;
    await db.user.update({
      where: { oid: user.oid },
      data: { accountOid }
    });
  }
);

export let finalizeAccountDeleteQueueProcessor = finalizeAccountDeleteQueue.process(
  async data => {
    let account = await db.account.findUnique({ where: { id: data.accountId } });
    if (!account || account.status !== 'deleting') return;

    let userCount = await db.user.count({ where: { accountOid: account.oid } });
    if (userCount > 0) throw new QueueRetryError();

    await withTransaction(async tdb => {
      await tdb.account.delete({ where: { oid: account.oid } });
    });
  }
);

export let reconcileAccountUsersProcessor = combineQueueProcessors([
  reconcileAccountUsersQueueProcessor,
  reconcileSingleAccountUserQueueProcessor,
  finalizeAccountDeleteQueueProcessor
]);
