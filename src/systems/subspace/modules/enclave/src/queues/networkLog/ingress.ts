import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db, getId } from '@metorial-subspace/db';
import { env } from '../../env';
import {
  type BufferedIngressNetworkLogEntry,
  deleteIngressNetworkLogSnapshotEntry,
  flushBufferedIngressNetworkLogsToRedis,
  getIngressNetworkLogSnapshotEntry,
  snapshotPendingIngressNetworkLogs
} from '../../lib/ingressNetworkLogBuffer';

let persistIngressNetworkLog = async (entry: BufferedIngressNetworkLogEntry) => {
  let bucketStart = new Date(entry.bucketStart);
  let firstSeenAt = new Date(entry.firstSeenAt);
  let lastSeenAt = new Date(entry.lastSeenAt);

  let existing = await db.enclaveIngressNetworkLog.findFirst({
    where: {
      tenantOid: entry.tenantOid,
      environmentOid: entry.environmentOid,
      solutionOid: entry.solutionOid,
      enclaveOid: entry.enclaveOid,
      sessionId: entry.sessionId,
      sourceIp: entry.sourceIp,
      hostname: entry.hostname,
      port: entry.port,
      result: entry.result,
      bucketStart
    },
    select: {
      oid: true,
      firstSeenAt: true,
      lastSeenAt: true
    }
  });

  if (existing) {
    await db.enclaveIngressNetworkLog.update({
      where: { oid: existing.oid },
      data: {
        count: { increment: entry.count },
        firstSeenAt: firstSeenAt < existing.firstSeenAt ? firstSeenAt : existing.firstSeenAt,
        lastSeenAt: lastSeenAt > existing.lastSeenAt ? lastSeenAt : existing.lastSeenAt
      }
    });
    return;
  }

  await db.enclaveIngressNetworkLog.create({
    data: {
      ...getId('enclaveIngressNetworkLog'),
      tenantOid: entry.tenantOid,
      environmentOid: entry.environmentOid,
      solutionOid: entry.solutionOid,
      enclaveOid: entry.enclaveOid,
      sessionId: entry.sessionId,
      sourceIp: entry.sourceIp,
      hostname: entry.hostname,
      port: entry.port,
      result: entry.result,
      bucketStart,
      count: entry.count,
      firstSeenAt,
      lastSeenAt
    }
  });
};

let ingressNetworkLogPersistCron = createCron(
  {
    name: 'sub/enc/netLog/ingress/cron',
    cron: '*/5 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await ingressNetworkLogPersistManyQueue.add(
      {},
      { id: `ingress-network-log-persist:${Math.floor(Date.now() / (5 * 60 * 1000))}` }
    );
  }
);

export let ingressNetworkLogPersistManyQueue = createQueue<{}>({
  name: 'sub/enc/netLog/ingress/many',
  redisUrl: env.service.REDIS_URL
});

let ingressNetworkLogPersistManyQueueProcessor =
  ingressNetworkLogPersistManyQueue.process(async () => {
    await flushBufferedIngressNetworkLogsToRedis();

    let snapshot = await snapshotPendingIngressNetworkLogs();
    if (!snapshot || snapshot.fields.length === 0) return;

    await ingressNetworkLogPersistSingleQueue.addMany(
      snapshot.fields.map(field => ({
        snapshotId: snapshot.snapshotId,
        field
      }))
    );
  });

let ingressNetworkLogPersistSingleQueue = createQueue<{
  snapshotId: string;
  field: string;
}>({
  name: 'sub/enc/netLog/ingress/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5 }
});

let ingressNetworkLogPersistSingleQueueProcessor =
  ingressNetworkLogPersistSingleQueue.process(async data => {
    let entry = await getIngressNetworkLogSnapshotEntry(data);
    if (!entry) return;

    try {
      await persistIngressNetworkLog(entry);
      await deleteIngressNetworkLogSnapshotEntry(data);
    } catch {
      throw new QueueRetryError();
    }
  });

export let ingressNetworkLogProcessors = combineQueueProcessors([
  ingressNetworkLogPersistCron,
  ingressNetworkLogPersistManyQueueProcessor,
  ingressNetworkLogPersistSingleQueueProcessor
]);
