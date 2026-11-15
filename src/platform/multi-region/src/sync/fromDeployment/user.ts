import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createQueue, hourlyPacedDelay } from '@metorial/queue';
import { cell } from '../../cell';
import { globalDB } from '../../db';
import { upsertUser } from '../../lib/upsertUser';

let SYNC_PAGE_SIZE = 500;

export let syncUsersCron = createCron(
  {
    name: 'global/sync/from-deployment/user',
    cron: process.env.NODE_ENV == 'production' ? '0 * * * *' : '* * * * *'
  },
  async () => {
    await syncUsersManyQueue.add({});
  }
);

let syncUsersManyQueue = createQueue<{ cursor?: string }>({
  name: 'global/sync/from-deployment/user-many',
  workerOpts: { concurrency: 1 }
});

export let syncUsersManyQueueProcessor = syncUsersManyQueue.process(async data => {
  let users = await db.user.findMany({
    where: {
      id: { gt: data.cursor },
      type: 'user'
    },
    orderBy: { id: 'asc' },
    take: SYNC_PAGE_SIZE,
    select: { id: true }
  });
  if (users.length === 0) return;

  await syncUserSingleQueue.addMany(users.map(user => ({ userId: user.id })));

  if (users.length === SYNC_PAGE_SIZE) {
    await syncUsersManyQueue.add({ cursor: users[users.length - 1].id }, hourlyPacedDelay());
  }
});

let syncUserSingleQueue = createQueue<{ userId: string; force?: boolean }>({
  name: 'global/sync/from-deployment/user-single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let syncUserSingleQueueProcessor = syncUserSingleQueue.process(async data => {
  let user = await db.user.findUnique({
    where: { id: data.userId, type: 'user' }
  });
  if (!user) return;

  let multiRegionUser = await globalDB.user.findUnique({
    where: { id: user.id }
  });

  // Whoever sends the last actual update is the owner and the sync should not override it
  if (!data.force && multiRegionUser && multiRegionUser.lastEditByOid === (await cell).oid)
    return;

  try {
    await upsertUser(user);
  } catch (err: any) {
    if (err.code !== 'P2002') throw err;
  }
});

Fabric.listen('user.updated:after', async event => {
  await syncUserSingleQueue.add({ userId: event.user.id, force: true });
});

Fabric.listen('user.created:after', async event => {
  await syncUserSingleQueue.add({ userId: event.user.id, force: true });
});
