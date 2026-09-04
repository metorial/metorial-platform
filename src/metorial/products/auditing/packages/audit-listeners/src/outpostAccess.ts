import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

export let recordOutpostAccessUpdated = async (
  event: FabricEvents['outpost_access.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'outpost_access', 'update', {
      payload: {
        outpostId: event.outpost.id,
        organizationId: event.organization.id,
        grants: event.access.map(item => ({
          projectId: item.project.id,
          instanceId: item.instance.id,
          services: item.services
        }))
      },
      recordedAt
    });
  });
};

Fabric.listen('outpost_access.updated:after', recordOutpostAccessUpdated);
