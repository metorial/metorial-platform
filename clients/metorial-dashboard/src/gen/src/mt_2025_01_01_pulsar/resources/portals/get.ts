import { mtMap } from '@metorial/util-resource-mapper';

export type PortalsGetOutput = {
  object: 'portal';
  id: string;
  status: 'active' | 'inactive';
  name: string;
  slug: string;
  description: string | null;
  brand: { image: string; name: string };
  createdAt: Date;
  updatedAt: Date;
};

export let mapPortalsGetOutput = mtMap.object<PortalsGetOutput>({
  object: mtMap.objectField('object', mtMap.passthrough()),
  id: mtMap.objectField('id', mtMap.passthrough()),
  status: mtMap.objectField('status', mtMap.passthrough()),
  name: mtMap.objectField('name', mtMap.passthrough()),
  slug: mtMap.objectField('slug', mtMap.passthrough()),
  description: mtMap.objectField('description', mtMap.passthrough()),
  brand: mtMap.objectField(
    'brand',
    mtMap.object({
      image: mtMap.objectField('image', mtMap.passthrough()),
      name: mtMap.objectField('name', mtMap.passthrough())
    })
  ),
  createdAt: mtMap.objectField('created_at', mtMap.date()),
  updatedAt: mtMap.objectField('updated_at', mtMap.date())
});

