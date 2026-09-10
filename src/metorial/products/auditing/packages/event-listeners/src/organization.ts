import { Fabric, type FabricEvents } from '@metorial/fabric';
import { enqueueSystemEvent } from '@metorial/module-event-tracker';
import { recordSystemEventAfterCommit } from './record';

export let recordOrganizationCreatedEvent = async (
  event: FabricEvents['organization.initialized:after']
) => {
  await recordSystemEventAfterCommit(async () => {
    await enqueueSystemEvent({
      eventType: 'organization.created',
      organizationId: event.organization.id,
      instanceId: null,
      payload: { organization: event.organization }
    });
  });
};

Fabric.listen('organization.initialized:after', recordOrganizationCreatedEvent);
