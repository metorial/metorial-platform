import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import {
  combineQueueProcessors,
  createQueue,
  hourlyPacedDelay,
  QueueRetryError
} from '@metorial/queue';
import { OUTPOST_INSTANCE_RETENTION_MS } from '../lib/constants';
import { outpostInstanceService } from '../services/outpostInstance';

let CLEANUP_BATCH_SIZE = 500;

let retentionCutoff = () => new Date(Date.now() - OUTPOST_INSTANCE_RETENTION_MS);

let cleanupCron = createCron(
  { name: 'outp/instance/cleanup', cron: '0 * * * *' },
  async () => {
    await cleanupManyQueue.add({}, { id: 'many' });
  }
);

let cleanupManyQueue = createQueue<{ cursor?: string }>({
  name: 'outp/instance/cleanupMany',
  workerOpts: { concurrency: 1 }
});

let cleanupManyQueueProcessor = cleanupManyQueue.process(async data => {
  let cutoff = retentionCutoff();

  let instancesToDelete = await db.outpostInstance.findMany({
    where: {
      status: 'inactive',
      // Instances that never got a token fall back to when they were last touched.
      OR: [{ expiresAt: { lte: cutoff } }, { expiresAt: null, updatedAt: { lte: cutoff } }],
      id: data.cursor ? { gt: data.cursor } : undefined
    },
    orderBy: { id: 'asc' },
    take: CLEANUP_BATCH_SIZE,
    select: { id: true }
  });
  if (instancesToDelete.length === 0) return;

  await cleanupSingleQueue.addManyWithOps(
    instancesToDelete.map(instance => ({
      data: { outpostInstanceId: instance.id },
      opts: { id: instance.id }
    }))
  );

  if (instancesToDelete.length === CLEANUP_BATCH_SIZE) {
    await cleanupManyQueue.add(
      { cursor: instancesToDelete[instancesToDelete.length - 1]!.id },
      hourlyPacedDelay()
    );
  }
});

let cleanupSingleQueue = createQueue<{ outpostInstanceId: string }>({
  name: 'outp/instance/cleanupSingle',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
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
  cleanupManyQueueProcessor,
  cleanupSingleQueueProcessor
]);
