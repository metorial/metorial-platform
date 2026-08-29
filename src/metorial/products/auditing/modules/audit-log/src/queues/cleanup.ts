import { deleteAuditEventsBefore } from '@metorial/audit-models';
import { createCron } from '@metorial/cron';
import { db, withTransaction } from '@metorial/db';
import { combineQueueProcessors, createQueue, QueueRetryError } from '@metorial/queue';

export let AUDIT_LOG_CLEANUP_BATCH_SIZE = 100;

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
  name: 'audit/log/cleanup/organizations'
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

    let lastOrganization = organizations.at(-1);
    if (lastOrganization) {
      await cleanupAuditLogOrganizationsQueue.add({ cursor: lastOrganization.id });
    }
  });

export let cleanupOrganizationAuditLogsQueue = createQueue<{ organizationId: string }>({
  name: 'audit/log/cleanup/organization',
  workerOpts: { concurrency: 5 }
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

    await withTransaction(async tx => {
      await tx.auditLog.deleteMany({
        where: { organizationOid: organization.oid, recordedAt: { lt: recordedAt } }
      });
      await tx.event.deleteMany({
        where: { organizationOid: organization.oid, recordedAt: { lt: recordedAt } }
      });
    });

    await deleteAuditEventsBefore({ organizationOid: organization.oid, recordedAt });
  });

export let auditLogCleanupQueueProcessor = combineQueueProcessors([
  cleanupAuditLogsCron,
  cleanupAuditLogOrganizationsQueueProcessor,
  cleanupOrganizationAuditLogsQueueProcessor
]);
