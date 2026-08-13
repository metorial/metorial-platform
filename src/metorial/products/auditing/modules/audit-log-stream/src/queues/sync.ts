import { createCron } from '@metorial/cron';
import { db, ID } from '@metorial/db';
import { createLock } from '@metorial/lock';
import { createQueue } from '@metorial/queue';
import { auditLogStreamSyncService } from '../internal/auditLogStreamSync';

let DIRTY_ORGANIZATION_BATCH_SIZE = 100;

export type SyncAuditLogStreamJob = {
  auditLogStreamId: string;
  runId: string;
  batchIdentifier: string;
  batchNumber: number;
  successfulBatchCount: number;
};

export let syncAuditLogStreamQueue = createQueue<SyncAuditLogStreamJob>({
  name: 'audit/stream/sync',
  workerOpts: {
    concurrency: 5
  }
});

let syncAuditLogStreamLock = createLock({
  name: 'audit/stream/sync/lock'
});

export let syncAuditLogStreamQueueProcessor = syncAuditLogStreamQueue.process(async data =>
  syncAuditLogStreamLock.usingLock(data.auditLogStreamId, async () => {
    let result = await auditLogStreamSyncService.syncBatch(data);
    if (result.status != 'success' || !result.shouldContinue) return;

    let nextBatchNumber = data.batchNumber + 1;
    await syncAuditLogStreamQueue.add(
      {
        auditLogStreamId: data.auditLogStreamId,
        runId: await ID.generateId('auditLogStreamRun'),
        batchIdentifier: data.batchIdentifier,
        batchNumber: nextBatchNumber,
        successfulBatchCount: result.successfulBatchCount
      },
      {
        id: `${data.auditLogStreamId}:${data.batchIdentifier}:${nextBatchNumber}`
      }
    );
  })
);

export let scavengeDirtyAuditLogOrganizationsQueue = createQueue<{
  cursor?: string;
}>({
  name: 'audit/stream/scavenge'
});

export let scavengeDirtyAuditLogOrganizationsQueueProcessor =
  scavengeDirtyAuditLogOrganizationsQueue.process(async data => {
    let dirtyOrganizations = await db.auditLogDirtyTracker.findMany({
      where: {
        organizationOid: data.cursor ? { gt: BigInt(data.cursor) } : undefined
      },
      include: {
        organization: {
          select: {
            auditLogStreams: {
              where: {
                status: 'active',
                isPausedDueToError: false
              },
              select: { id: true }
            }
          }
        }
      },
      orderBy: { organizationOid: 'asc' },
      take: DIRTY_ORGANIZATION_BATCH_SIZE
    });
    if (!dirtyOrganizations.length) return;

    let jobs = (
      await Promise.all(
        dirtyOrganizations.flatMap(marker =>
          marker.organization.auditLogStreams.map(async stream => {
            let batchIdentifier = await ID.generateId('auditLogStreamBatch');
            return {
              auditLogStreamId: stream.id,
              runId: await ID.generateId('auditLogStreamRun'),
              batchIdentifier,
              batchNumber: 1,
              successfulBatchCount: 0
            };
          })
        )
      )
    ).flat();

    if (jobs.length) {
      await syncAuditLogStreamQueue.addMany(jobs);
    }

    await Promise.all(
      dirtyOrganizations.map(marker =>
        db.auditLogDirtyTracker.deleteMany({
          where: {
            organizationOid: marker.organizationOid,
            revision: marker.revision
          }
        })
      )
    );

    if (dirtyOrganizations.length == DIRTY_ORGANIZATION_BATCH_SIZE) {
      await scavengeDirtyAuditLogOrganizationsQueue.add({
        cursor: dirtyOrganizations.at(-1)!.organizationOid.toString()
      });
    }
  });

export let scavengeDirtyAuditLogOrganizationsCron = createCron(
  {
    name: 'audit/stream/scavenge/cron',
    cron: '*/15 * * * *'
  },
  async () => {
    await scavengeDirtyAuditLogOrganizationsQueue.add(
      {},
      { id: 'audit-stream-dirty-organizations' }
    );
  }
);
