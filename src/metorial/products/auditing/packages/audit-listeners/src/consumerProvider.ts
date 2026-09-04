import {
  Fabric,
  type AuditConsumerSurfaceProviderGroup,
  type FabricEvents
} from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

let groupPayload = (
  group: AuditConsumerSurfaceProviderGroup,
  consumerSurfaceId: string | null
) => ({
  id: group.id,
  name: group.name,
  description: group.description,
  index: group.index,
  consumerSurfaceId
});

let groupReference = (group: AuditConsumerSurfaceProviderGroup) => ({
  id: group.id,
  name: group.name
});

export let recordConsumerProviderDeployed = async (
  event: FabricEvents['consumer.provider.deployed:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'consumer_provider_deployment',
      'deploy',
      { payload: event.deployment, recordedAt }
    );
  });
};

export let recordConsumerSurfaceProviderGroupCreated = async (
  event: FabricEvents['consumer.surface_provider_group.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'consumer_surface_provider_group',
      'create',
      {
        payload: groupPayload(event.consumerSurfaceProviderGroup, event.consumerSurface.id),
        recordedAt
      }
    );
  });
};

export let recordConsumerSurfaceProviderGroupUpdated = async (
  event: FabricEvents['consumer.surface_provider_group.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'consumer_surface_provider_group',
      'update',
      {
        payload: groupPayload(event.consumerSurfaceProviderGroup, event.consumerSurface.id),
        previousPayload: groupPayload(
          event.previousConsumerSurfaceProviderGroup,
          event.consumerSurface.id
        ),
        recordedAt
      }
    );
  });
};

export let recordConsumerSurfaceProviderGroupDeleted = async (
  event: FabricEvents['consumer.surface_provider_group.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'consumer_surface_provider_group',
      'delete',
      {
        payload: groupPayload(event.consumerSurfaceProviderGroup, event.consumerSurface.id),
        recordedAt
      }
    );
  });
};

export let recordConsumerSurfaceProviderGroupListingAdded = async (
  event: FabricEvents['consumer.surface_provider_group.listing.added:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'consumer_surface_provider_group_listing',
      'add',
      {
        payload: {
          consumerSurfaceProviderGroup: groupReference(event.consumerSurfaceProviderGroup),
          consumerAccessListingId: event.consumerAccessListing.id
        },
        recordedAt
      }
    );
  });
};

export let recordConsumerSurfaceProviderGroupListingRemoved = async (
  event: FabricEvents['consumer.surface_provider_group.listing.removed:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'consumer_surface_provider_group_listing',
      'remove',
      {
        payload: {
          consumerSurfaceProviderGroup: groupReference(event.consumerSurfaceProviderGroup),
          consumerAccessListingId: event.consumerAccessListing.id
        },
        recordedAt
      }
    );
  });
};

Fabric.listen('consumer.provider.deployed:after', recordConsumerProviderDeployed);

Fabric.listen(
  'consumer.surface_provider_group.created:after',
  recordConsumerSurfaceProviderGroupCreated
);
Fabric.listen(
  'consumer.surface_provider_group.updated:after',
  recordConsumerSurfaceProviderGroupUpdated
);
Fabric.listen(
  'consumer.surface_provider_group.deleted:after',
  recordConsumerSurfaceProviderGroupDeleted
);
Fabric.listen(
  'consumer.surface_provider_group.listing.added:after',
  recordConsumerSurfaceProviderGroupListingAdded
);
Fabric.listen(
  'consumer.surface_provider_group.listing.removed:after',
  recordConsumerSurfaceProviderGroupListingRemoved
);
