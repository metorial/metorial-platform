import { getImageUrl, ImportedServerVendor } from '@metorial/db';

export let vendorPresenter = async (vendor: ImportedServerVendor) => ({
  object: 'marketplace*vendor',

  id: vendor.id,
  identifier: vendor.identifier,
  name: vendor.name,
  description: vendor.description,

  imageUrl: await getImageUrl(vendor),

  attributes: vendor.attributes,

  createdAt: vendor.createdAt,
  updatedAt: vendor.updatedAt
});
