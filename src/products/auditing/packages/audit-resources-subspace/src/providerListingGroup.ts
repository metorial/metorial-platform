import { v } from '@lowerdeck/validation';
import { resource } from '@metorial/audit-stash';

export let providerListingGroupAuditResource = resource({
  name: 'provider_listing_group',
  payload: v.typedAny<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
  }>('provider_listing_group'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export let providerListingGroupListingAuditResource = resource({
  name: 'provider_listing_group_listing',
  payload: v.typedAny<{
    providerGroup: { id: string; name: string; slug: string };
    providerListingId: string;
    provider: { id: string; name: string };
  }>('provider_listing_group_listing'),
  presenter: undefined,
  actions: {
    add: true,
    remove: true
  }
});
