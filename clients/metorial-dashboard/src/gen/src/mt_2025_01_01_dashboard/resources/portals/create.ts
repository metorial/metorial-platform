import { mtMap } from '@metorial/util-resource-mapper';

export type PortalsCreateOutput = {
  object: 'portal';
  id: string;
  status: 'active' | 'inactive';
  name: string;
  slug: string;
  description: string | null;
  auth: { object: 'portal.auth'; sessionExpiryTimeInSeconds: number };
  urls: { type: 'default'; url: string }[];
  brand: { image: string; name: string };
  createdAt: Date;
  updatedAt: Date;
};

export let mapPortalsCreateOutput = mtMap.object<PortalsCreateOutput>({
  object: mtMap.objectField('object', mtMap.passthrough()),
  id: mtMap.objectField('id', mtMap.passthrough()),
  status: mtMap.objectField('status', mtMap.passthrough()),
  name: mtMap.objectField('name', mtMap.passthrough()),
  slug: mtMap.objectField('slug', mtMap.passthrough()),
  description: mtMap.objectField('description', mtMap.passthrough()),
  auth: mtMap.objectField(
    'auth',
    mtMap.object({
      object: mtMap.objectField('object', mtMap.passthrough()),
      sessionExpiryTimeInSeconds: mtMap.objectField(
        'session_expiry_time_in_seconds',
        mtMap.passthrough()
      )
    })
  ),
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

export type PortalsCreateBody = {
  name: string;
  description?: string | undefined;
};

export let mapPortalsCreateBody = mtMap.object<PortalsCreateBody>({
  name: mtMap.objectField('name', mtMap.passthrough()),
  description: mtMap.objectField('description', mtMap.passthrough())
});

