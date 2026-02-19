import { mtMap } from '@metorial/util-resource-mapper';

export type PublishersGetOutput = {
  object: 'provider.publisher';
  id: string;
  name: string;
  description: string | null;
  slug: string;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapPublishersGetOutput = mtMap.object<PublishersGetOutput>({
  object: mtMap.objectField('object', mtMap.passthrough()),
  id: mtMap.objectField('id', mtMap.passthrough()),
  name: mtMap.objectField('name', mtMap.passthrough()),
  description: mtMap.objectField('description', mtMap.passthrough()),
  slug: mtMap.objectField('slug', mtMap.passthrough()),
  imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
  createdAt: mtMap.objectField('created_at', mtMap.date()),
  updatedAt: mtMap.objectField('updated_at', mtMap.date())
});
