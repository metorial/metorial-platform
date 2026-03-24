import { createCron } from '@metorial/cron';
import { db, User } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createQueue } from '@metorial/queue';
import { cell } from '../../cell';
import { globalDB } from '../../db';

let syncUser = async (user: User) => {
  let inner = {
    status: user.status,
    type: user.type,
    email: user.email,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    image: user.image,
    createdAt: user.createdAt,
    deletedAt: user.deletedAt,

    lastEditByOid: (await cell).oid
  };

  await globalDB.user.upsert({
    where: { id: user.id },
    update: inner,
    create: { id: user.id, ...inner }
  });
};

Fabric.listen('user.updated:after', async event => {
  await syncUser(event.user);
});

Fabric.listen('user.created:after', async event => {
  await syncUser(event.user);
});

export let syncUsersCron = createCron(
  {
    name: 'global/sync/to-deployment/user',
    cron: process.env.NODE_ENV == 'production' ? '0 * * * *' : '* * * * *'
  },
  async () => {
    await syncUsersManyQueue.add({});
  }
);

let syncUsersManyQueue = createQueue<{ cursor?: string }>({
  name: 'global/sync/to-deployment/user-many'
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

let syncUserSingleQueue = createQueue<{ userId: string }>({
  name: 'global/sync/to-deployment/user-single'
});

export let syncUserSingleQueueProcessor = syncUserSingleQueue.process(async data => {
  let user = await db.user.findUnique({
    where: { id: data.userId }
  });
  if (!user) return;

  await syncUser(user);
});
