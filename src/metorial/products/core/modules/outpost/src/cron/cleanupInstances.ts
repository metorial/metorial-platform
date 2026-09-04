import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue, QueueRetryError } from '@metorial/queue';
import { OUTPOST_INSTANCE_RETENTION_MS } from '../lib/constants';
import { outpostInstanceService } from '../services/outpostInstance';

let retentionCutoff = () => new Date(Date.now() - OUTPOST_INSTANCE_RETENTION_MS);

let cleanupCron = createCron(
  { name: 'outp/instance/cleanup', cron: '0 * * * *' },
  async () => {
    let cutoff = retentionCutoff();

    let instancesToDelete = await db.outpostInstance.findMany({
      where: {
        status: 'inactive',
        // Instances that never got a token fall back to when they were last touched.
        OR: [{ expiresAt: { lte: cutoff } }, { expiresAt: null, updatedAt: { lte: cutoff } }]
      },
      select: { id: true }
    });
    if (instancesToDelete.length === 0) return;

    await cleanupSingleQueue.addMany(
      instancesToDelete.map(instance => ({ outpostInstanceId: instance.id }))
    );
  }
);

let cleanupSingleQueue = createQueue<{ outpostInstanceId: string }>({
  name: 'outp/instance/cleanupSingle',
  workerOpts: { concurrency: 5 }
});

let cleanupSingleQueueProcessor = cleanupSingleQueue.process(async data => {
  let instance = await db.outpostInstance.findUnique({
    where: { id: data.outpostInstanceId },
    include: { outpost: { include: { organization: true } } }
  });
  if (!instance) throw new QueueRetryError();

  let cutoff = retentionCutoff();
  let lastActivity = instance.expiresAt ?? instance.updatedAt;

  if (instance.status == 'active' || lastActivity.getTime() > cutoff.getTime()) return;

  await outpostInstanceService.deleteInstance({
    instance,
    outpost: instance.outpost,
    organization: instance.outpost.organization
  });
});

export let cleanupOutpostInstancesProcessors = combineQueueProcessors([
  cleanupCron,
  cleanupSingleQueueProcessor
]);
