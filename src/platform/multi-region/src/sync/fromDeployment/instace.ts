import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createQueue, hourlyPacedDelay } from '@metorial/queue';
import { cell } from '../../cell';
import { globalDB } from '../../db';

let SYNC_PAGE_SIZE = 500;

export let upsertInstance = async (instanceId: string) => {
  let instance = await db.instance.findUnique({
    where: { id: instanceId }
  });
  if (!instance) return;

  let inner = {
    status: instance.status,
    type: instance.type,
    name: instance.name,
    slug: instance.slug,
    createdAt: instance.createdAt,
    deletedAt: instance.deletedAt
  };

  await globalDB.instance.upsert({
    where: { id: instance.id },
    update: inner,
    create: { id: instance.id, ...inner, ownerOid: (await cell).oid }
  });
};

export let syncInstancesCron = createCron(
  {
    name: 'global/sync/from-deployment/inst',
    cron: process.env.NODE_ENV == 'production' ? '0 * * * *' : '* * * * *'
  },
  async () => {
    await syncInstancesManyQueue.add({});
  }
);

let syncInstancesManyQueue = createQueue<{ cursor?: string }>({
  name: 'global/sync/from-deployment/inst-many',
  workerOpts: { concurrency: 1 }
});

export let syncInstancesManyQueueProcessor = syncInstancesManyQueue.process(async data => {
  let instances = await db.instance.findMany({
    where: {
      id: { gt: data.cursor }
    },
    orderBy: { id: 'asc' },
    take: SYNC_PAGE_SIZE,
    select: { id: true }
  });
  if (instances.length === 0) return;

  await syncInstanceSingleQueue.addMany(instances.map(inst => ({ instanceId: inst.id })));

  if (instances.length === SYNC_PAGE_SIZE) {
    await syncInstancesManyQueue.add(
      { cursor: instances[instances.length - 1].id },
      hourlyPacedDelay()
    );
  }
});

let syncInstanceSingleQueue = createQueue<{ instanceId: string }>({
  name: 'global/sync/from-deployment/inst-single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let syncInstanceSingleQueueProcessor = syncInstanceSingleQueue.process(async data => {
  await upsertInstance(data.instanceId);
});

Fabric.listen('organization.project.instance.updated:after', async event => {
  await syncInstanceSingleQueue.add({ instanceId: event.instance.id });
});

Fabric.listen('organization.project.instance.created:after', async event => {
  await syncInstanceSingleQueue.add({ instanceId: event.instance.id });
});
