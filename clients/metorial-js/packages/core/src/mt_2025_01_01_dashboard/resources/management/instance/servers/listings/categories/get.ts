import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceServersListingsCategoriesGetOutput = {
  id: string;
  name: string;
  slug: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceServersListingsCategoriesGetOutput =
  mtMap.object<ManagementInstanceServersListingsCategoriesGetOutput>({
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

