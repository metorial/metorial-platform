import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

let eventDestinationPayload = (eventDestination: {
  id: string;
  name: string;
  description: string | null;
  status: string;
  type: string;
  webhookDestination?: { url: string; method: string } | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: eventDestination.id,
  name: eventDestination.name,
  description: eventDestination.description,
  status: eventDestination.status,
  type: eventDestination.type,
  webhookUrl: eventDestination.webhookDestination?.url ?? null,
  webhookMethod: eventDestination.webhookDestination?.method ?? null,
  createdAt: eventDestination.createdAt,
  updatedAt: eventDestination.updatedAt
});

export let recordEventDestinationCreated = async (
  event: FabricEvents['organization.event_destination.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'event_destination', 'create', {
      payload: eventDestinationPayload(event.eventDestination),
      recordedAt
    });
  });
};

export let recordEventDestinationUpdated = async (
  event: FabricEvents['organization.event_destination.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'event_destination', 'update', {
      payload: eventDestinationPayload(event.eventDestination),
      previousPayload: eventDestinationPayload(event.previousEventDestination),
      recordedAt
    });
  });
};

export let recordEventDestinationArchived = async (
  event: FabricEvents['organization.event_destination.archived:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'event_destination', 'archive', {
      payload: eventDestinationPayload(event.eventDestination),
      previousPayload: eventDestinationPayload(event.previousEventDestination),
      recordedAt
    });
  });
};

Fabric.listen('organization.event_destination.created:after', recordEventDestinationCreated);
Fabric.listen('organization.event_destination.updated:after', recordEventDestinationUpdated);
Fabric.listen('organization.event_destination.archived:after', recordEventDestinationArchived);
