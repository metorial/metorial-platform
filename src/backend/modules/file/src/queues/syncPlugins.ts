import { createCron } from '@metorial/cron';
import { db, SkillPluginStatus } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { cargo } from '../cargo';

export let syncPluginsCron = createCron(
  {
    name: 'skil/plug/sync/cron',
    cron: '* * * * *'
  },
  async () => {
    await syncPluginsManyQueue.add({});
  }
);

let syncPluginsManyQueue = createQueue({
  name: 'skil/plug/sync/many',
  workerOpts: { concurrency: 1 }
});

export let syncPluginsManyQueueProcessor = syncPluginsManyQueue.process(async () => {
  let currentCursor = await db.skillPluginSync.findFirst();

  let res = await cargo.reconcile.listSkillPlugins({
    limit: 100,
    order: 'asc',
    after: currentCursor?.cursor ?? undefined
  });

  await syncPluginsSingleQueue.addManyWithOps(
    res.items.map(s => ({
      data: {
        id: s.id,
        isManaged: s.isManaged,
        name: s.name,
        slug: s.slug,
        status: s.status,
        updatedAt: s.updatedAt,
        createdAt: s.createdAt,
        cargoEnvironmentId: s.environment.id
      },
      opts: { id: s.id }
    }))
  );

  let nextCursor = res.items.length > 0 ? res.items[res.items.length - 1].id : null;
  if (!nextCursor) return;

  await db.skillPluginSync.upsert({
    where: { oid: 0 },
    create: {
      oid: 0,
      cursor: nextCursor
    },
    update: {
      cursor: nextCursor,
      updatedAt: new Date()
    }
  });
});

let syncPluginsSingleQueue = createQueue<{
  id: string;
  isManaged: boolean;
  name: string;
  slug: string;
  status: SkillPluginStatus;
  updatedAt: Date;
  createdAt: Date;
  cargoEnvironmentId: string;
}>({
  name: 'skil/plug/sync/single'
});

export let syncPluginsSingleQueueProcessor = syncPluginsSingleQueue.process(async data => {
  let instance = await db.instance.findFirst({
    where: { cargoEnvironmentId: data.cargoEnvironmentId }
  });
  if (!instance) return;

  await db.skillPlugin.upsert({
    where: {
      id: data.id
    },
    create: {
      id: data.id,
      isManaged: true,
      name: data.name,
      slug: data.slug,
      status: data.status,
      organizationOid: instance.organizationOid,
      instanceOid: instance.oid,
      updatedAt: data.updatedAt,
      createdAt: data.createdAt
    },
    update: {
      name: data.name,
      slug: data.slug,
      status: data.status,
      updatedAt: data.updatedAt
    }
  });
});
