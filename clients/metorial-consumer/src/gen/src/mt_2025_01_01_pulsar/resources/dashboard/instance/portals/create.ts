import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstancePortalsCreateOutput = {
  object: 'portal';
  id: string;
  status: 'active' | 'inactive';
  name: string;
  slug: string;
  description: string | null;
  urls: { type: 'default'; url: string }[];
  brand: { image: string; name: string };
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstancePortalsCreateOutput =
  mtMap.object<DashboardInstancePortalsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    urls: mtMap.objectField(
      'urls',
      mtMap.array(
        mtMap.object({
          type: mtMap.objectField('type', mtMap.passthrough()),
          url: mtMap.objectField('url', mtMap.passthrough())
        })
      )
    ),
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

export type DashboardInstancePortalsCreateBody = {
  name: string;
  description?: string | undefined;
};

export let mapDashboardInstancePortalsCreateBody =
  mtMap.object<DashboardInstancePortalsCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough())
  });

