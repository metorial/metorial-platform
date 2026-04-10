import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createQueue } from '@metorial/queue';
import { cell } from '../../cell';
import { globalDB } from '../../db';
import { upsertUser } from '../../lib/upsertUser';

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
  name: 'global/sync/from-deployment/user-many'
});

export let syncUsersManyQueueProcessor = syncUsersManyQueue.process(async data => {
  let users = await db.user.findMany({
    where: {
      id: { gt: data.cursor }
    },
    orderBy: { id: 'asc' },
    take: 100,
    select: { id: true }
  });
  if (users.length === 0) return;

  await syncUserSingleQueue.addMany(users.map(user => ({ userId: user.id })));

  await syncUsersManyQueue.add({ cursor: users[users.length - 1].id });
});

let syncUserSingleQueue = createQueue<{ userId: string; force?: boolean }>({
  name: 'global/sync/from-deployment/user-single'
});

export let syncUserSingleQueueProcessor = syncUserSingleQueue.process(async data => {
  let user = await db.user.findUnique({
    where: { id: data.userId }
  });
  if (!user) return;

  let multiRegionUser = await globalDB.user.findUnique({
    where: { id: user.id }
  });

  // Whoever sends the last actual update is the owner and the sync should not override it
  if (!data.force && multiRegionUser && multiRegionUser.lastEditByOid === (await cell).oid)
    return;

  await upsertUser(user);
});

Fabric.listen('user.updated:after', async event => {
  await syncUserSingleQueue.add({ userId: event.user.id, force: true });
});

Fabric.listen('user.created:after', async event => {
  await syncUserSingleQueue.add({ userId: event.user.id, force: true });
});
