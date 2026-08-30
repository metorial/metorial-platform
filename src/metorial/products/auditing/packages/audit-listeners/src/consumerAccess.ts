import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';
import {
  consumerAccessListingTargetPayload,
  consumerAccessTargetPayload,
  truncateAuditedText
} from './workforce';

let readmeByteSize = (readme: string | null) =>
  readme ? new TextEncoder().encode(readme).length : 0;

let consumerAccessPayload = (
  consumerAccess: FabricEvents['consumer.access.created:after']['consumerAccess']
) => ({
  id: consumerAccess.id,
  accessLevel: consumerAccess.accessLevel,
  surfaceId: consumerAccess.surface.id,
  consumerGroup: {
    id: consumerAccess.consumerGroup.id,
    name: consumerAccess.consumerGroup.name,
    type: consumerAccess.consumerGroup.type
  },
  target: consumerAccessTargetPayload(consumerAccess.type, consumerAccess),
  listing: consumerAccess.listing
    ? {
        id: consumerAccess.listing.id,
        name: consumerAccess.listing.name,
        description: consumerAccess.listing.description,
        readmeByteSize: readmeByteSize(consumerAccess.listing.readme)
      }
    : null
});

let consumerAccessListingPayload = (
  consumerAccessListing: FabricEvents['consumer.access_listing.created:after']['consumerAccessListing']
) => ({
  id: consumerAccessListing.id,
  name: consumerAccessListing.name,
  description: consumerAccessListing.description,
  readmeByteSize: readmeByteSize(consumerAccessListing.readme),
  surfaceId: consumerAccessListing.surface.id,
  target: consumerAccessListingTargetPayload(consumerAccessListing)
});

let consumerAccessRequestPayload = (
  consumerAccessRequest: FabricEvents['consumer.access_request.created:after']['consumerAccessRequest']
) => {
  let message = truncateAuditedText(consumerAccessRequest.message);
  let resolutionMessage = truncateAuditedText(consumerAccessRequest.resolutionMessage);

  return {
    id: consumerAccessRequest.id,
    status: consumerAccessRequest.status,
    surfaceId: consumerAccessRequest.surface.id,
    consumerProfile: {
      id: consumerAccessRequest.consumerProfile.id,
      email: consumerAccessRequest.consumerProfile.email
    },
    target: consumerAccessTargetPayload(consumerAccessRequest.type, consumerAccessRequest),
    message: message.value,
    messageTruncated: message.truncated,
    resolutionMessage: resolutionMessage.value,
    resolutionMessageTruncated: resolutionMessage.truncated,
    reviewedAt: consumerAccessRequest.reviewedAt
  };
};

export let recordConsumerAccessCreated = async (
  event: FabricEvents['consumer.access.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'consumer_access', 'create', {
      payload: consumerAccessPayload(event.consumerAccess),
      recordedAt
    });
  });
};

export let recordConsumerAccessUpdated = async (
  event: FabricEvents['consumer.access.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'consumer_access', 'update', {
      payload: consumerAccessPayload(event.consumerAccess),
      previousPayload: consumerAccessPayload(event.previousConsumerAccess),
      recordedAt
    });
  });
};

export let recordConsumerAccessDeleted = async (
  event: FabricEvents['consumer.access.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'consumer_access', 'delete', {
      payload: consumerAccessPayload(event.consumerAccess),
      recordedAt
    });
  });
};

export let recordConsumerAccessListingCreated = async (
  event: FabricEvents['consumer.access_listing.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'consumer_access_listing',
      'create',
      { payload: consumerAccessListingPayload(event.consumerAccessListing), recordedAt }
    );
  });
};

export let recordConsumerAccessListingUpdated = async (
  event: FabricEvents['consumer.access_listing.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'consumer_access_listing',
      'update',
      {
        payload: consumerAccessListingPayload(event.consumerAccessListing),
        previousPayload: consumerAccessListingPayload(event.previousConsumerAccessListing),
        recordedAt
      }
    );
  });
};

export let recordConsumerAccessListingDeleted = async (
  event: FabricEvents['consumer.access_listing.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'consumer_access_listing',
      'delete',
      { payload: consumerAccessListingPayload(event.consumerAccessListing), recordedAt }
    );
  });
};

export let recordConsumerAccessRequestCreated = async (
  event: FabricEvents['consumer.access_request.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'consumer_access_request',
      'create',
      { payload: consumerAccessRequestPayload(event.consumerAccessRequest), recordedAt }
    );
  });
};

export let recordConsumerAccessRequestReviewed = async (
  event: FabricEvents['consumer.access_request.reviewed:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'consumer_access_request',
      'update',
      {
        payload: consumerAccessRequestPayload(event.consumerAccessRequest),
        previousPayload: consumerAccessRequestPayload(event.previousConsumerAccessRequest),
        recordedAt
      }
    );
  });
};

export let recordConsumerProviderSetupSessionCreated = async (
  event: FabricEvents['consumer.integration_setup_session.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'consumer_provider_setup_session',
      'create',
      {
        payload: {
          id: event.binding.id,
          setupSessionId: event.setupSession.id,
          surfaceId: event.consumerSurface.id,
          consumerProfile: {
            id: event.consumerProfile.id,
            email: event.consumerProfile.email
          },
          providerTemplate: {
            id: event.providerTemplate.id,
            name: event.providerTemplate.name
          }
        },
        recordedAt
      }
    );
  });
};

Fabric.listen('consumer.access.created:after', recordConsumerAccessCreated);
Fabric.listen('consumer.access.updated:after', recordConsumerAccessUpdated);
Fabric.listen('consumer.access.deleted:after', recordConsumerAccessDeleted);
Fabric.listen('consumer.access_listing.created:after', recordConsumerAccessListingCreated);
Fabric.listen('consumer.access_listing.updated:after', recordConsumerAccessListingUpdated);
Fabric.listen('consumer.access_listing.deleted:after', recordConsumerAccessListingDeleted);
Fabric.listen('consumer.access_request.created:after', recordConsumerAccessRequestCreated);
Fabric.listen('consumer.access_request.reviewed:after', recordConsumerAccessRequestReviewed);
Fabric.listen(
  'consumer.integration_setup_session.created:after',
  recordConsumerProviderSetupSessionCreated
);
