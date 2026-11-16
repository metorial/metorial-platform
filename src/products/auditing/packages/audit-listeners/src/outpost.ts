import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

let outpostPayload = (
  outpost: {
    id: string;
    status: string;
    connectionStatus: string;
    name: string;
    description: string | null;
  },
  organizationId: string
) => ({
  id: outpost.id,
  status: outpost.status,
  connectionStatus: outpost.connectionStatus,
  organizationId,
  name: outpost.name,
  description: outpost.description
});

export let recordOutpostCreated = async (event: FabricEvents['outpost.created:after']) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'outpost', 'create', {
      payload: outpostPayload(event.outpost, event.organization.id),
      recordedAt
    });
  });
};

export let recordOutpostUpdated = async (event: FabricEvents['outpost.updated:after']) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'outpost', 'update', {
      payload: outpostPayload(event.outpost, event.organization.id),
      previousPayload: outpostPayload(event.previousOutpost, event.organization.id),
      recordedAt
    });
  });
};

export let recordOutpostDisabled = async (event: FabricEvents['outpost.disabled:after']) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'outpost', 'disable', {
      payload: outpostPayload(event.outpost, event.organization.id),
      previousPayload: outpostPayload(event.previousOutpost, event.organization.id),
      recordedAt
    });
  });
};

export let recordOutpostEnabled = async (event: FabricEvents['outpost.enabled:after']) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'outpost', 'enable', {
      payload: outpostPayload(event.outpost, event.organization.id),
      previousPayload: outpostPayload(event.previousOutpost, event.organization.id),
      recordedAt
    });
  });
};

export let recordOutpostDeleted = async (event: FabricEvents['outpost.deleted:after']) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'outpost', 'delete', {
      payload: outpostPayload(event.outpost, event.organization.id),
      previousPayload: outpostPayload(event.previousOutpost, event.organization.id),
      recordedAt
    });
  });
};

Fabric.listen('outpost.created:after', recordOutpostCreated);
Fabric.listen('outpost.updated:after', recordOutpostUpdated);
Fabric.listen('outpost.disabled:after', recordOutpostDisabled);
Fabric.listen('outpost.enabled:after', recordOutpostEnabled);
Fabric.listen('outpost.deleted:after', recordOutpostDeleted);
