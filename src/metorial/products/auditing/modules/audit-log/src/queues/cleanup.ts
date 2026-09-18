import { deleteAuditEventsBefore } from '@metorial/audit-models';
import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import {
  combineQueueProcessors,
  createQueue,
  dailyPacedDelay,
  deleteInChunks,
  QueueRetryError
} from '@metorial/queue';

export let AUDIT_LOG_CLEANUP_BATCH_SIZE = 500;

let AUDIT_LOG_DELETE_CHUNK_SIZE = 10_000;

export let cleanupAuditLogsCron = createCron(
  {
    name: 'audit/log/cleanup/cron',
    cron: '0 4 * * *'
  },
  async () => {
    await cleanupAuditLogOrganizationsQueue.add({}, { id: 'audit-log-cleanup-organizations' });
  }
);

export let cleanupAuditLogOrganizationsQueue = createQueue<{ cursor?: string }>({
  name: 'audit/log/cleanup/organizations',
  workerOpts: { concurrency: 1 }
});

export let cleanupAuditLogOrganizationsQueueProcessor =
  cleanupAuditLogOrganizationsQueue.process(async data => {
    let organizations = await db.organization.findMany({
      where: {
        status: 'active',
        auditLogRetentionInDays: { not: null },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: AUDIT_LOG_CLEANUP_BATCH_SIZE,
      select: { id: true }
    });
    if (organizations.length === 0) return;

    await cleanupOrganizationAuditLogsQueue.addMany(
      organizations.map(organization => ({ organizationId: organization.id }))
    );

    if (organizations.length === AUDIT_LOG_CLEANUP_BATCH_SIZE) {
      await cleanupAuditLogOrganizationsQueue.add(
        { cursor: organizations[organizations.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  });

export let cleanupOrganizationAuditLogsQueue = createQueue<{ organizationId: string }>({
  name: 'audit/log/cleanup/organization',
  workerOpts: { concurrency: 5, limiter: { max: 5, duration: 1000 } }
});

export let cleanupOrganizationAuditLogsQueueProcessor =
  cleanupOrganizationAuditLogsQueue.process(async data => {
    let organization = await db.organization.findUnique({
      where: { id: data.organizationId },
      select: { oid: true, auditLogRetentionInDays: true }
    });
    if (!organization) throw new QueueRetryError();
    if (organization.auditLogRetentionInDays == null) return;

    let cutoffMs = Date.now() - organization.auditLogRetentionInDays * 24 * 60 * 60 * 1000;
    if (!Number.isFinite(cutoffMs) || cutoffMs <= 0) return;

    let recordedAt = new Date(cutoffMs);
    let where = { organizationOid: organization.oid, recordedAt: { lt: recordedAt } };

    let logs = await deleteInChunks({
      chunkSize: AUDIT_LOG_DELETE_CHUNK_SIZE,
      selectKeys: take =>
        db.auditLog
          .findMany({ where, take, select: { oid: true } })
          .then(r => r.map(l => l.oid)),
      deleteKeys: oids => db.auditLog.deleteMany({ where: { oid: { in: oids } } })
    });

    let events = await deleteInChunks({
      chunkSize: AUDIT_LOG_DELETE_CHUNK_SIZE,
      selectKeys: take =>
        db.auditLogEvent
          .findMany({ where, take, select: { oid: true } })
          .then(r => r.map(e => e.oid)),
      deleteKeys: oids => db.auditLogEvent.deleteMany({ where: { oid: { in: oids } } })
    });

    if (logs.hasMore || events.hasMore) {
      await cleanupOrganizationAuditLogsQueue.add(
        { organizationId: data.organizationId },
        dailyPacedDelay()
      );
      return;
    }

    await deleteAuditEventsBefore({ organizationOid: organization.oid, recordedAt });
  });

export let auditLogCleanupQueueProcessor = combineQueueProcessors([
  cleanupAuditLogsCron,
  cleanupAuditLogOrganizationsQueueProcessor,
  cleanupOrganizationAuditLogsQueueProcessor
]);
