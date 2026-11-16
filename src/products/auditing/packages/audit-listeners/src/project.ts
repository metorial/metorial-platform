import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

export let recordProjectCreated = async (
  event: FabricEvents['organization.project.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'project', 'create', {
      payload: {
        project: event.project
      },
      recordedAt
    });
  });
};

export let recordProjectUpdated = async (
  event: FabricEvents['organization.project.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'project', 'update', {
      payload: {
        project: event.project
      },
      previousPayload: {
        project: {
          ...event.previousProject,
          organization: event.organization
        }
      },
      recordedAt
    });
  });
};

export let recordProjectDeleted = async (
  event: FabricEvents['organization.project.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'project', 'delete', {
      payload: {
        project: event.project
      },
      recordedAt
    });
  });
};

Fabric.listen('organization.project.created:after', recordProjectCreated);
Fabric.listen('organization.project.updated:after', recordProjectUpdated);
Fabric.listen('organization.project.deleted:after', recordProjectDeleted);
