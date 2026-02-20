import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstancePublishersGetOutput = {
  object: 'provider.publisher';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  imageUrl: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstancePublishersGetOutput =
  mtMap.object<ManagementInstancePublishersGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

