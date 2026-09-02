import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue, QueueRetryError } from '@metorial/queue';
import { outpostInstanceService } from '../services/outpostInstance';

let deactivateCron = createCron(
  { name: 'outp/instance/deactivate', cron: '* * * * *' },
  async () => {
    let instancesToDeactivate = await db.outpostInstance.findMany({
      where: { status: 'active', expiresAt: { lte: new Date() } },
      select: { id: true }
    });
    if (instancesToDeactivate.length === 0) return;

    await deactivateSingleQueue.addMany(
      instancesToDeactivate.map(instance => ({ outpostInstanceId: instance.id }))
    );
  }
);

let deactivateSingleQueue = createQueue<{ outpostInstanceId: string }>({
  name: 'outp/instance/deactivateSingle',
  workerOpts: { concurrency: 5 }
});

let deactivateSingleQueueProcessor = deactivateSingleQueue.process(async data => {
  let instance = await db.outpostInstance.findUnique({
    where: { id: data.outpostInstanceId },
    include: { outpost: { include: { organization: true } } }
  });
  if (!instance) throw new QueueRetryError();

  if (instance.status != 'active') return;
  if (instance.expiresAt && instance.expiresAt.getTime() > Date.now()) return;

  await outpostInstanceService.deactivateInstance({
    instance,
    outpost: instance.outpost,
    organization: instance.outpost.organization
  });
});

export let deactivateOutpostInstancesProcessors = combineQueueProcessors([
  deactivateCron,
  deactivateSingleQueueProcessor
]);
