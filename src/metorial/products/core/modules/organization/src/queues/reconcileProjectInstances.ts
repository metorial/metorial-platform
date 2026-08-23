import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue, QueueRetryError } from '@metorial/queue';
import { instanceService } from '../services';

export let RECONCILE_PROJECT_INSTANCES_BATCH_SIZE = 500;

export let reconcileProjectInstancesCron = createCron(
  {
    name: 'org/instances/reconcile/cron',
    cron: '0 5 * * *'
  },
  async () => {
    await reconcileProjectInstancesSearchQueue.add(
      {},
      { id: 'org-instances-reconcile-search' }
    );
  }
);

export let reconcileProjectInstancesSearchQueue = createQueue<{ cursor?: string }>({
  name: 'org/instances/reconcile/search'
});

setTimeout(() => {
  reconcileProjectInstancesSearchQueue.add({});
}, 10000);

export let reconcileProjectInstancesSearchQueueProcessor =
  reconcileProjectInstancesSearchQueue.process(async data => {
    let instances = await db.instance.findMany({
      where: {
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined,
        hasBeenReconciled2: false
      },
      orderBy: { id: 'asc' },
      take: RECONCILE_PROJECT_INSTANCES_BATCH_SIZE,
      select: {
        id: true
      }
    });
    if (instances.length === 0) return;

    await reconcileProjectInstancesQueue.addMany(
      instances.map(instance => ({
        instanceId: instance.id
      }))
    );

    let lastInstance = instances[instances.length - 1];
    if (!lastInstance) return;

    await reconcileProjectInstancesSearchQueue.add({
      cursor: lastInstance.id
    });
  });

export let reconcileProjectInstancesQueue = createQueue<{ instanceId: string }>({
  name: 'org/instances/reconcile/instance',
  workerOpts: { concurrency: 5 }
});

export let reconcileProjectInstancesQueueProcessor = reconcileProjectInstancesQueue.process(
  async data => {
    let instance = await db.instance.findUnique({
      where: { id: data.instanceId },
      include: { project: true }
    });
    if (!instance) throw new QueueRetryError();

    if (instance.oldSlug) return;

    let slug = await instanceService.generateInstanceSlug({
      project: instance.project,
      input: instance
    });

    await db.instance.updateMany({
      where: {
        id: data.instanceId,
        oldSlug: null,
        hasBeenReconciled2: false
      },
      data: {
        hasBeenReconciled2: true,
        slug,
        oldSlug: instance.slug,
        previousSlugs: {
          push: instance.slug
        }
      }
    });
  }
);

export let reconcileProjectInstancesProcessors = combineQueueProcessors([
  reconcileProjectInstancesCron,
  reconcileProjectInstancesSearchQueueProcessor,
  reconcileProjectInstancesQueueProcessor
]);
