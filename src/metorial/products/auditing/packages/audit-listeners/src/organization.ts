import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

export let recordOrganizationInitialized = async (
  event: FabricEvents['organization.initialized:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'organization', 'create', {
      payload: {
        organization: event.organization
      },
      recordedAt
    });
  });
};

export let recordOrganizationUpdated = async (
  event: FabricEvents['organization.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'organization', 'update', {
      payload: {
        organization: event.organization
      },
      previousPayload: {
        organization: event.previousOrganization
      },
      recordedAt
    });
  });
};

export let recordOrganizationDeleted = async (
  event: FabricEvents['organization.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'organization', 'delete', {
      payload: {
        organization: event.organization
      },
      recordedAt
    });
  });
};

Fabric.listen('organization.initialized:after', recordOrganizationInitialized);
Fabric.listen('organization.updated:after', recordOrganizationUpdated);
Fabric.listen('organization.deleted:after', recordOrganizationDeleted);
