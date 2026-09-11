import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { getSubspaceAuditScope, recordSubspaceAuditEvent } from './_shared';

let groupPayload = (group: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}) => ({
  id: group.id,
  name: group.name,
  slug: group.slug,
  description: group.description
});

export let recordProviderListingGroupCreated = async (
  event: FabricEvents['provider.provider_listing_group.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'provider_listing_group', 'create', {
      payload: groupPayload(event.providerGroup)
    })
  );
};

export let recordProviderListingGroupUpdated = async (
  event: FabricEvents['provider.provider_listing_group.updated:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'provider_listing_group', 'update', {
      payload: groupPayload(event.providerGroup),
      previousPayload: groupPayload(event.previousProviderGroup)
    })
  );
};

export let recordProviderListingGroupDeleted = async (
  event: FabricEvents['provider.provider_listing_group.deleted:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'provider_listing_group', 'delete', {
      payload: groupPayload(event.providerGroup)
    })
  );
};

Fabric.listen(
  'provider.provider_listing_group.created:after',
  recordProviderListingGroupCreated
);
Fabric.listen(
  'provider.provider_listing_group.updated:after',
  recordProviderListingGroupUpdated
);
Fabric.listen(
  'provider.provider_listing_group.deleted:after',
  recordProviderListingGroupDeleted
);

let membershipPayload = (
  event:
    | FabricEvents['provider.provider_listing_group.listing.added:after']
    | FabricEvents['provider.provider_listing_group.listing.removed:after']
) => ({
  providerGroup: {
    id: event.providerGroup.id,
    name: event.providerGroup.name,
    slug: event.providerGroup.slug
  },
  providerListingId: event.providerListing.id,
  provider: {
    id: event.providerListing.provider.id,
    name: event.providerListing.provider.name
  }
});

export let recordProviderListingGroupListingAdded = async (
  event: FabricEvents['provider.provider_listing_group.listing.added:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'provider_listing_group_listing', 'add', {
      payload: membershipPayload(event)
    })
  );
};

export let recordProviderListingGroupListingRemoved = async (
  event: FabricEvents['provider.provider_listing_group.listing.removed:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'provider_listing_group_listing', 'remove', {
      payload: membershipPayload(event)
    })
  );
};

Fabric.listen(
  'provider.provider_listing_group.listing.added:after',
  recordProviderListingGroupListingAdded
);
Fabric.listen(
  'provider.provider_listing_group.listing.removed:after',
  recordProviderListingGroupListingRemoved
);
