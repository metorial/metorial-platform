import { db } from '@metorial/db';
import {
  combineQueueProcessors,
  createQueue,
  dailyPacedDelay,
  QueueRetryError
} from '@metorial/queue';
import { instanceService } from '../services';

export let RECONCILE_PROJECT_INSTANCES_BATCH_SIZE = 500;

export let startProjectInstanceReconciliation = async () => {
  await reconcileProjectInstancesSearchQueue.add({}, { id: 'org-instances-reconcile-search' });
};

export let reconcileProjectInstancesSearchQueue = createQueue<{ cursor?: string }>({
  name: 'org/instances/reconcile/search'
});

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

    if (instances.length === RECONCILE_PROJECT_INSTANCES_BATCH_SIZE) {
      await reconcileProjectInstancesSearchQueue.add(
        { cursor: instances[instances.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  });

export let reconcileProjectInstancesQueue = createQueue<{ instanceId: string }>({
  name: 'org/instances/reconcile/instance',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
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
  reconcileProjectInstancesSearchQueueProcessor,
  reconcileProjectInstancesQueueProcessor
]);
