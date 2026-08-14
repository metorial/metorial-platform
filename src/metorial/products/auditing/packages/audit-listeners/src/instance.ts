import { bindAuditScope } from '@metorial/audit-scope';
import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

let getInstanceAuditScope = (
  event:
    | FabricEvents['organization.project.instance.created:after']
    | FabricEvents['organization.project.instance.updated:after']
    | FabricEvents['organization.project.instance.deleted:after']
) =>
  bindAuditScope({
    scope: event.auditScope,
    organization: event.organization,
    instance: event.instance
  });

export let recordInstanceCreated = async (
  event: FabricEvents['organization.project.instance.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(getInstanceAuditScope(event), 'instance', 'create', {
      payload: {
        instance: event.instance
      },
      recordedAt
    });
  });
};

export let recordInstanceUpdated = async (
  event: FabricEvents['organization.project.instance.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(getInstanceAuditScope(event), 'instance', 'update', {
      payload: {
        instance: event.instance
      },
      previousPayload: {
        instance: {
          ...event.previousInstance,
          organization: event.organization,
          project: event.project
        }
      },
      recordedAt
    });
  });
};

export let recordInstanceDeleted = async (
  event: FabricEvents['organization.project.instance.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(getInstanceAuditScope(event), 'instance', 'delete', {
      payload: {
        instance: event.instance
      },
      recordedAt
    });
  });
};

Fabric.listen('organization.project.instance.created:after', recordInstanceCreated);
Fabric.listen('organization.project.instance.updated:after', recordInstanceUpdated);
Fabric.listen('organization.project.instance.deleted:after', recordInstanceDeleted);
