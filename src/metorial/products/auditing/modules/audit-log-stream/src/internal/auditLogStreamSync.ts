import { Service } from '@lowerdeck/service';
import { createOrganizationActorAuditScope } from '@metorial/audit-scope';
import { db, ID, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { auditLogService } from '@metorial/module-audit-log';
import { organizationActorService } from '@metorial/module-organization';
import { AuditLogDestinationError, deliverAuditLogStreamEvents } from '../destinations';
import { markAuditLogOrganizationDirty } from '../lib/dirty';
import { decryptAuditLogStreamProviderData } from '../lib/providerData';

export let AUDIT_LOG_STREAM_BATCH_SIZE = 100;
export let AUDIT_LOG_STREAM_MAX_CONSECUTIVE_ERRORS = 100;

let startOfUtcDay = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

let errorMessage = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).slice(0, 4000);

let createSystemAuditScope = async (organizationOid: bigint) => {
  let organization = await db.organization.findUniqueOrThrow({
    where: { oid: organizationOid }
  });
  let organizationActor = await organizationActorService.getSystemActor({ organization });

  return {
    organization,
    auditScope: createOrganizationActorAuditScope({
      organization,
      organizationActor,
      context: { ip: '0.0.0.0', ua: 'Metorial System' }
    })
  };
};

class AuditLogStreamSyncService {
  async syncBatch(d: {
    auditLogStreamId: string;
    runId: string;
    batchIdentifier: string;
    batchNumber: number;
    successfulBatchCount: number;
  }) {
    let existingRun = await db.auditLogStreamRun.findUnique({
      where: { id: d.runId }
    });
    if (existingRun?.status == 'success') {
      return {
        status: 'success' as const,
        recordsSynced: existingRun.recordsSynced,
        successfulBatchCount: existingRun.successfulBatchCount,
        shouldContinue: existingRun.recordsSynced == AUDIT_LOG_STREAM_BATCH_SIZE
      };
    }
    if (existingRun?.status == 'error') {
      return {
        status: 'error' as const,
        recordsSynced: 0,
        successfulBatchCount: existingRun.successfulBatchCount,
        shouldContinue: false
      };
    }

    let stream = await db.auditLogStream.findUnique({
      where: { id: d.auditLogStreamId }
    });
    if (!stream || stream.status != 'active' || stream.isPausedDueToError) {
      return {
        status: 'skipped' as const,
        recordsSynced: 0,
        successfulBatchCount: d.successfulBatchCount,
        shouldContinue: false
      };
    }

    await withTransaction(async db => {
      await db.auditLogStreamRun.upsert({
        where: { id: d.runId },
        create: {
          id: d.runId,
          status: 'running',
          batchIdentifier: d.batchIdentifier,
          batchNumber: d.batchNumber,
          successfulBatchCount: d.successfulBatchCount,
          recordsSynced: 0,
          auditLogStreamOid: stream.oid
        },
        update: {}
      });

      if (!stream.isStarted) {
        await db.auditLogStream.update({
          where: { oid: stream.oid },
          data: { isStarted: true }
        });
        await db.auditLogStreamEvent.create({
          data: {
            id: await ID.generateId('auditLogStreamEvent'),
            type: 'started',
            auditLogStreamOid: stream.oid
          }
        });
      }
    });

    let batch = await auditLogService.listAuditLogsForStream({
      organizationOid: stream.organizationOid,
      recordedAtGte: startOfUtcDay(stream.createdAt),
      afterOid: stream.lastAuditLogOid,
      limit: AUDIT_LOG_STREAM_BATCH_SIZE
    });

    try {
      if (batch.items.length) {
        let providerData = await decryptAuditLogStreamProviderData({
          streamId: stream.id,
          provider: stream.provider,
          encryptedProviderData: stream.encryptedProviderData
        });
        await deliverAuditLogStreamEvents({
          provider: stream.provider,
          providerData,
          events: batch.items
        });
      }
    } catch (error) {
      let message = errorMessage(error);
      let destinationError = error instanceof AuditLogDestinationError ? error.details : null;
      let details = {
        provider: stream.provider,
        code: destinationError?.code ?? 'unknown_error',
        errorName: error instanceof Error ? error.name : typeof error,
        httpStatusCode: destinationError?.httpStatusCode ?? null,
        httpStatusText: destinationError?.httpStatusText ?? null,
        providerErrorCode: destinationError?.providerErrorCode ?? null,
        responseBody: destinationError?.responseBody ?? null,
        batchIdentifier: d.batchIdentifier,
        batchNumber: d.batchNumber,
        successfulBatchCount: d.successfulBatchCount,
        eventCount: batch.items.length,
        firstEventId: batch.items.at(0)?.id ?? null,
        lastEventId: batch.items.at(-1)?.id ?? null
      };
      let consecutiveErrorCount = stream.consecutiveErrorCount + 1;
      let shouldPause = consecutiveErrorCount >= AUDIT_LOG_STREAM_MAX_CONSECUTIVE_ERRORS;

      await withTransaction(async db => {
        await db.auditLogStreamRun.update({
          where: { id: d.runId },
          data: {
            status: 'error',
            errorMessage: message,
            recordsSynced: 0,
            successfulBatchCount: d.successfulBatchCount,
            completedAt: new Date()
          }
        });
        await db.auditLogStream.update({
          where: { oid: stream.oid },
          data: {
            accessStatus: 'error',
            errorMessage: message,
            consecutiveErrorCount,
            isPausedDueToError: shouldPause
          }
        });

        if (stream.accessStatus != 'error') {
          await db.auditLogStreamEvent.create({
            data: {
              id: await ID.generateId('auditLogStreamEvent'),
              type: 'error',
              message,
              errorDetails: details,
              auditLogStreamOid: stream.oid
            }
          });
        }
        if (shouldPause && !stream.isPausedDueToError) {
          let { organization, auditScope } = await createSystemAuditScope(
            stream.organizationOid
          );

          await Fabric.fire('organization.audit_log_stream.paused:before', {
            organization,
            auditScope,
            auditLogStream: stream
          });

          await db.auditLogStreamEvent.create({
            data: {
              id: await ID.generateId('auditLogStreamEvent'),
              type: 'error_paused',
              message,
              errorDetails: details,
              auditLogStreamOid: stream.oid
            }
          });

          await Fabric.fire('organization.audit_log_stream.paused:after', {
            organization,
            auditScope,
            auditLogStream: {
              ...stream,
              accessStatus: 'error',
              errorMessage: message,
              consecutiveErrorCount,
              isPausedDueToError: true
            },
            previousAuditLogStream: stream
          });
        }
        if (!shouldPause) {
          await markAuditLogOrganizationDirty(stream.organizationOid, db);
        }
      });

      return {
        status: 'error' as const,
        recordsSynced: 0,
        successfulBatchCount: d.successfulBatchCount,
        shouldContinue: false
      };
    }

    let successfulBatchCount = d.successfulBatchCount + 1;
    await withTransaction(async db => {
      await db.auditLogStreamRun.update({
        where: { id: d.runId },
        data: {
          status: 'success',
          recordsSynced: batch.items.length,
          successfulBatchCount,
          completedAt: new Date()
        }
      });
      await db.auditLogStream.update({
        where: { oid: stream.oid },
        data: {
          lastAuditLogOid: batch.lastAuditLogOid ?? undefined,
          lastEventId: batch.items.at(-1)?.id,
          accessStatus: 'ok',
          errorMessage: null,
          consecutiveErrorCount: 0,
          isPausedDueToError: false
        }
      });

      if (stream.accessStatus == 'error') {
        await db.auditLogStreamEvent.create({
          data: {
            id: await ID.generateId('auditLogStreamEvent'),
            type: 'recovered',
            auditLogStreamOid: stream.oid
          }
        });
      }
    });

    return {
      status: 'success' as const,
      recordsSynced: batch.items.length,
      successfulBatchCount,
      shouldContinue: batch.items.length == AUDIT_LOG_STREAM_BATCH_SIZE
    };
  }
}

export let auditLogStreamSyncService = Service.create(
  'auditLogStreamSyncService',
  () => new AuditLogStreamSyncService()
).build();
