import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

export let recordEventDeliveryRetried = async (
  event: FabricEvents['organization.event_delivery.retried:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'event_delivery', 'retry', {
      payload: {
        id: event.eventDelivery.id,
        eventId: event.eventDelivery.systemEvent.id,
        eventType: event.eventDelivery.systemEvent.eventType,
        eventDestinationId: event.eventDelivery.eventDestination.id,
        status: event.eventDelivery.status,
        attemptCount: event.eventDelivery.attemptCount
      },
      recordedAt
    });
  });
};

Fabric.listen('organization.event_delivery.retried:after', recordEventDeliveryRetried);
