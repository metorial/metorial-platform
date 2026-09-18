import { createSystemAuditScope } from '@metorial/audit-scope';
import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import {
  combineQueueProcessors,
  createQueue,
  hourlyPacedDelay,
  QueueRetryError
} from '@metorial/queue';
import { OUTPOST_INSTANCE_LOG_RETENTION_MS } from '../lib/constants';

let CLEANUP_LOGS_BATCH_SIZE = 500;

let retentionCutoff = () => new Date(Date.now() - OUTPOST_INSTANCE_LOG_RETENTION_MS);

let cleanupLogsCron = createCron(
  { name: 'outp/instance/cleanupLogs', cron: '30 * * * *' },
  async () => {
    await cleanupLogsManyQueue.add({}, { id: 'many' });
  }
);

let cleanupLogsManyQueue = createQueue<{ cursor?: string }>({
  name: 'outp/instance/cleanupLogsMany',
  workerOpts: { concurrency: 1 }
});

let cleanupLogsManyQueueProcessor = cleanupLogsManyQueue.process(async data => {
  let cutoff = retentionCutoff();

  let instances = await db.outpostInstance.findMany({
    where: {
      OR: [
        { events: { some: { createdAt: { lte: cutoff } } } },
        { keyRotations: { some: { createdAt: { lte: cutoff } } } }
      ],
      id: data.cursor ? { gt: data.cursor } : undefined
    },
    orderBy: { id: 'asc' },
    take: CLEANUP_LOGS_BATCH_SIZE,
    select: { id: true }
  });
  if (instances.length === 0) return;

  await cleanupLogsSingleQueue.addManyWithOps(
    instances.map(instance => ({
      data: { outpostInstanceId: instance.id },
      opts: { id: instance.id }
    }))
  );

  if (instances.length === CLEANUP_LOGS_BATCH_SIZE) {
    await cleanupLogsManyQueue.add(
      { cursor: instances[instances.length - 1]!.id },
      hourlyPacedDelay()
    );
  }
});

let cleanupLogsSingleQueue = createQueue<{ outpostInstanceId: string }>({
  name: 'outp/instance/cleanupLogsSingle',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

let cleanupLogsSingleQueueProcessor = cleanupLogsSingleQueue.process(async data => {
  let instance = await db.outpostInstance.findUnique({
    where: { id: data.outpostInstanceId },
    include: { outpost: { include: { organization: true } } }
  });
  if (!instance) throw new QueueRetryError();

  let cutoff = retentionCutoff();

  let [events, keyRotations] = await Promise.all([
    db.outpostInstanceEvent.deleteMany({
      where: { instanceOid: instance.oid, createdAt: { lte: cutoff } }
    }),
    db.outpostInstanceKeyRotation.deleteMany({
      where: { instanceOid: instance.oid, createdAt: { lte: cutoff } }
    })
  ]);

  if (events.count === 0 && keyRotations.count === 0) return;

  await Fabric.fire('outpost_instance.pruned:after', {
    instance,
    outpost: instance.outpost,
    organization: instance.outpost.organization,
    deleted: { events: events.count, keyRotations: keyRotations.count },
    auditScope: createSystemAuditScope({
      organization: instance.outpost.organization,
      job: 'outpost_instance_log_retention',
      metadata: { outpostId: instance.outpost.id, instanceIdentifier: instance.identifier },
      context: { ip: '0.0.0.0', ua: 'Metorial System' }
    })
  });
});

export let cleanupOutpostInstanceLogsProcessors = combineQueueProcessors([
  cleanupLogsCron,
  cleanupLogsManyQueueProcessor,
  cleanupLogsSingleQueueProcessor
]);
