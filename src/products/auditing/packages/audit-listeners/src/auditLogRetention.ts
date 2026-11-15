import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

export let recordAuditLogRetentionUpdated = async (
  event: FabricEvents['organization.audit_log_retention.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'audit_log_retention', 'update', {
      payload: { organization: event.organization },
      previousPayload: { organization: event.previousOrganization },
      recordedAt
    });
  });
};

Fabric.listen(
  'organization.audit_log_retention.updated:after',
  recordAuditLogRetentionUpdated
);
