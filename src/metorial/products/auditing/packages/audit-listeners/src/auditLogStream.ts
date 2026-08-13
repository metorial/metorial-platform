import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

let auditLogStreamPayload = (auditLogStream: {
  id: string;
  provider: string;
  status: string;
  accessStatus: string;
  isPausedDueToError: boolean;
  errorMessage: string | null;
  consecutiveErrorCount: number;
  isStarted: boolean;
  providerDataRedacted: unknown;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: auditLogStream.id,
  provider: auditLogStream.provider,
  status: auditLogStream.status,
  accessStatus: auditLogStream.accessStatus,
  isPausedDueToError: auditLogStream.isPausedDueToError,
  errorMessage: auditLogStream.errorMessage,
  consecutiveErrorCount: auditLogStream.consecutiveErrorCount,
  isStarted: auditLogStream.isStarted,
  providerDataRedacted: auditLogStream.providerDataRedacted,
  createdAt: auditLogStream.createdAt,
  updatedAt: auditLogStream.updatedAt
});

export let recordAuditLogStreamCreated = async (
  event: FabricEvents['organization.audit_log_stream.created:after']
) => {
  if (!event.auditScope) return;

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'audit_log_stream', 'create', {
      payload: auditLogStreamPayload(event.auditLogStream),
      recordedAt
    });
  });
};

export let recordAuditLogStreamUpdated = async (
  event: FabricEvents['organization.audit_log_stream.updated:after']
) => {
  if (!event.auditScope) return;

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'audit_log_stream', 'update', {
      payload: auditLogStreamPayload(event.auditLogStream),
      previousPayload: auditLogStreamPayload(event.previousAuditLogStream),
      recordedAt
    });
  });
};

export let recordAuditLogStreamDeleted = async (
  event: FabricEvents['organization.audit_log_stream.deleted:after']
) => {
  if (!event.auditScope) return;

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'audit_log_stream', 'delete', {
      payload: auditLogStreamPayload(event.auditLogStream),
      recordedAt
    });
  });
};

export let recordAuditLogStreamPaused = async (
  event: FabricEvents['organization.audit_log_stream.paused:after']
) => {
  if (!event.auditScope) return;

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'audit_log_stream', 'pause', {
      payload: auditLogStreamPayload(event.auditLogStream),
      previousPayload: auditLogStreamPayload(event.previousAuditLogStream),
      recordedAt
    });
  });
};

export let recordAuditLogStreamResumed = async (
  event: FabricEvents['organization.audit_log_stream.resumed:after']
) => {
  if (!event.auditScope) return;

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'audit_log_stream', 'resume', {
      payload: auditLogStreamPayload(event.auditLogStream),
      previousPayload: auditLogStreamPayload(event.previousAuditLogStream),
      recordedAt
    });
  });
};

Fabric.listen('organization.audit_log_stream.created:after', recordAuditLogStreamCreated);
Fabric.listen('organization.audit_log_stream.updated:after', recordAuditLogStreamUpdated);
Fabric.listen('organization.audit_log_stream.deleted:after', recordAuditLogStreamDeleted);
Fabric.listen('organization.audit_log_stream.paused:after', recordAuditLogStreamPaused);
Fabric.listen('organization.audit_log_stream.resumed:after', recordAuditLogStreamResumed);
