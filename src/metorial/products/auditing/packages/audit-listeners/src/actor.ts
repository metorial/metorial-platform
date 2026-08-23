import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

export let recordOrganizationActorCreated = async (
  event: FabricEvents['organization.actor.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'organization_actor', 'create', {
      payload: {
        organizationActor: event.actor
      },
      recordedAt
    });
  });
};

export let recordOrganizationActorUpdated = async (
  event: FabricEvents['organization.actor.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'organization_actor', 'update', {
      payload: {
        organizationActor: event.actor
      },
      previousPayload: {
        organizationActor: {
          ...event.previousActor,
          organization: event.organization
        }
      },
      recordedAt
    });
  });
};

Fabric.listen('organization.actor.created:after', recordOrganizationActorCreated);
Fabric.listen('organization.actor.updated:after', recordOrganizationActorUpdated);
