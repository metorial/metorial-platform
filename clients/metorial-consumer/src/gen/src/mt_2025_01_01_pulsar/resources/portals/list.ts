import { mtMap } from '@metorial/util-resource-mapper';

export type PortalsListOutput = {
  items: {
    object: 'portal';
    id: string;
    status: 'active' | 'inactive';
    name: string;
    slug: string;
    description: string | null;
    brand: { image: string; name: string };
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapPortalsListOutput = mtMap.object<PortalsListOutput>({
  items: mtMap.objectField(
    'items',
    mtMap.array(
      mtMap.object({
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
      })
    )
  ),
  pagination: mtMap.objectField(
    'pagination',
    mtMap.object({
      hasMoreBefore: mtMap.objectField('has_more_before', mtMap.passthrough()),
      hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
    })
  )
});

export type PortalsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapPortalsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough())
    })
  )
]);

