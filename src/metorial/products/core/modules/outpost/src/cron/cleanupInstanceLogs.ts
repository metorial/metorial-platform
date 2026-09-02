import { createSystemAuditScope } from '@metorial/audit-scope';
import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { combineQueueProcessors, createQueue, QueueRetryError } from '@metorial/queue';
import { OUTPOST_INSTANCE_LOG_RETENTION_MS } from '../lib/constants';

let retentionCutoff = () => new Date(Date.now() - OUTPOST_INSTANCE_LOG_RETENTION_MS);

let cleanupLogsCron = createCron(
  { name: 'outp/instance/cleanupLogs', cron: '30 * * * *' },
  async () => {
    let cutoff = retentionCutoff();

    let [instancesWithEvents, instancesWithRotations] = await Promise.all([
      db.outpostInstanceEvent.findMany({
        where: { createdAt: { lte: cutoff } },
        distinct: ['instanceOid'],
        select: { instanceOid: true }
      }),
      db.outpostInstanceKeyRotation.findMany({
        where: { createdAt: { lte: cutoff } },
        distinct: ['instanceOid'],
        select: { instanceOid: true }
      })
    ]);

    let instanceOids = new Set([
      ...instancesWithEvents.map(row => row.instanceOid),
      ...instancesWithRotations.map(row => row.instanceOid)
    ]);
    if (instanceOids.size === 0) return;

    let instances = await db.outpostInstance.findMany({
      where: { oid: { in: [...instanceOids] } },
      select: { id: true }
    });

    await cleanupLogsSingleQueue.addMany(
      instances.map(instance => ({ outpostInstanceId: instance.id }))
    );
  }
);

let cleanupLogsSingleQueue = createQueue<{ outpostInstanceId: string }>({
  name: 'outp/instance/cleanupLogsSingle',
  workerOpts: { concurrency: 5 }
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
  cleanupLogsSingleQueueProcessor
]);
