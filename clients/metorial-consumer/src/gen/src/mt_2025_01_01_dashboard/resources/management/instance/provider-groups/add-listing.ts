import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceProviderGroupsAddListingOutput = {
  object: 'provider.listing_group';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceProviderGroupsAddListingOutput =
  mtMap.object<ManagementInstanceProviderGroupsAddListingOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstanceProviderGroupsAddListingBody = {
  providerListingId: string;
};

export let mapManagementInstanceProviderGroupsAddListingBody =
  mtMap.object<ManagementInstanceProviderGroupsAddListingBody>({
    providerListingId: mtMap.objectField(
      'provider_listing_id',
      mtMap.passthrough()
    )
  });

