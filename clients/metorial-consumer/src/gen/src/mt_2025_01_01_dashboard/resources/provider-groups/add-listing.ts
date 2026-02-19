import { mtMap } from '@metorial/util-resource-mapper';

export type ProviderGroupsAddListingOutput = {
  object: 'provider.group';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapProviderGroupsAddListingOutput = mtMap.object<ProviderGroupsAddListingOutput>({
  object: mtMap.objectField('object', mtMap.passthrough()),
  id: mtMap.objectField('id', mtMap.passthrough()),
  name: mtMap.objectField('name', mtMap.passthrough()),
  description: mtMap.objectField('description', mtMap.passthrough()),
  slug: mtMap.objectField('slug', mtMap.passthrough()),
  createdAt: mtMap.objectField('created_at', mtMap.date()),
  updatedAt: mtMap.objectField('updated_at', mtMap.date())
});

export type ProviderGroupsAddListingBody = { providerListingId: string };

export let mapProviderGroupsAddListingBody = mtMap.object<ProviderGroupsAddListingBody>({
  providerListingId: mtMap.objectField('provider_listing_id', mtMap.passthrough())
});
