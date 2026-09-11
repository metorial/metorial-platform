import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

let eventDestinationListenerPayload = (listener: {
  id: string;
  eventDestination: { id: string };
  type: string;
  eventTypes: string[];
  callbackId: string | null;
  triggers: string[];
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: listener.id,
  eventDestinationId: listener.eventDestination.id,
  type: listener.type,
  eventTypes: listener.eventTypes,
  callbackId: listener.callbackId,
  triggers: listener.triggers,
  createdAt: listener.createdAt,
  updatedAt: listener.updatedAt
});

export let recordEventDestinationListenerCreated = async (
  event: FabricEvents['instance.event_destination_listener.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'event_destination_listener',
      'create',
      { payload: eventDestinationListenerPayload(event.listener), recordedAt }
    );
  });
};

export let recordEventDestinationListenerUpdated = async (
  event: FabricEvents['instance.event_destination_listener.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'event_destination_listener',
      'update',
      {
        payload: eventDestinationListenerPayload(event.listener),
        previousPayload: eventDestinationListenerPayload(event.previousListener),
        recordedAt
      }
    );
  });
};

export let recordEventDestinationListenerDeleted = async (
  event: FabricEvents['instance.event_destination_listener.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'event_destination_listener',
      'delete',
      { payload: eventDestinationListenerPayload(event.listener), recordedAt }
    );
  });
};

Fabric.listen(
  'instance.event_destination_listener.created:after',
  recordEventDestinationListenerCreated
);
Fabric.listen(
  'instance.event_destination_listener.updated:after',
  recordEventDestinationListenerUpdated
);
Fabric.listen(
  'instance.event_destination_listener.deleted:after',
  recordEventDestinationListenerDeleted
);
