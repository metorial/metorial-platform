import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceProviderListingsListOutput = {
  items: {
    object: 'provider.listing';
    id: string;
    name: string;
    description: string | null;
    slug: string;
    imageUrl: string | null;
    readme: string | null;
    skills: string[];
    flags: {
      isPublic: boolean;
      isCustomized: boolean;
      isMetorial: boolean;
      isVerified: boolean;
      isOfficial: boolean;
    };
    providerId: string | null;
    categories: {
      object: 'provider.category';
      id: string;
      name: string;
      description: string | null;
      slug: string;
      createdAt: Date;
      updatedAt: Date;
    }[];
    collections: {
      object: 'provider.collection';
      id: string;
      name: string;
      description: string | null;
      slug: string;
      createdAt: Date;
      updatedAt: Date;
    }[];
    groups: {
      object: 'provider.group';
      id: string;
      name: string;
      description: string | null;
      slug: string;
      createdAt: Date;
      updatedAt: Date;
    }[];
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceProviderListingsListOutput =
  mtMap.object<ManagementInstanceProviderListingsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          slug: mtMap.objectField('slug', mtMap.passthrough()),
          imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
          readme: mtMap.objectField('readme', mtMap.passthrough()),
          skills: mtMap.objectField('skills', mtMap.array(mtMap.passthrough())),
          flags: mtMap.objectField(
            'flags',
            mtMap.object({
              isPublic: mtMap.objectField('is_public', mtMap.passthrough()),
              isCustomized: mtMap.objectField('is_customized', mtMap.passthrough()),
              isMetorial: mtMap.objectField('is_metorial', mtMap.passthrough()),
              isVerified: mtMap.objectField('is_verified', mtMap.passthrough()),
              isOfficial: mtMap.objectField('is_official', mtMap.passthrough())
            })
          ),
          providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
          categories: mtMap.objectField(
            'categories',
            mtMap.array(
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                description: mtMap.objectField('description', mtMap.passthrough()),
                slug: mtMap.objectField('slug', mtMap.passthrough()),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date())
              })
            )
          ),
          collections: mtMap.objectField(
            'collections',
            mtMap.array(
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                description: mtMap.objectField('description', mtMap.passthrough()),
                slug: mtMap.objectField('slug', mtMap.passthrough()),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date())
              })
            )
          ),
          groups: mtMap.objectField(
            'groups',
            mtMap.array(
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                description: mtMap.objectField('description', mtMap.passthrough()),
                slug: mtMap.objectField('slug', mtMap.passthrough()),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date())
              })
            )
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

export type ManagementInstanceProviderListingsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  search?: string | undefined;
  providerId?: string | string[] | undefined;
  providerVersionId?: string | undefined;
  providerCategoryId?: string | string[] | undefined;
  providerCollectionId?: string | string[] | undefined;
  providerGroupId?: string | string[] | undefined;
  publisherId?: string | string[] | undefined;
  flags?:
    | {
        isPublic?: string | undefined;
        isVerified?: string | undefined;
        isOfficial?: string | undefined;
        isMetorial?: string | undefined;
      }
    | undefined;
};

export let mapManagementInstanceProviderListingsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      search: mtMap.objectField('search', mtMap.passthrough()),
      providerId: mtMap.objectField(
        'provider_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      providerVersionId: mtMap.objectField('provider_version_id', mtMap.passthrough()),
      providerCategoryId: mtMap.objectField(
        'provider_category_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      providerCollectionId: mtMap.objectField(
        'provider_collection_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      providerGroupId: mtMap.objectField(
        'provider_group_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      publisherId: mtMap.objectField(
        'publisher_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      flags: mtMap.objectField(
        'flags',
        mtMap.object({
          isPublic: mtMap.objectField('is_public', mtMap.passthrough()),
          isVerified: mtMap.objectField('is_verified', mtMap.passthrough()),
          isOfficial: mtMap.objectField('is_official', mtMap.passthrough()),
          isMetorial: mtMap.objectField('is_metorial', mtMap.passthrough())
        })
      )
    })
  )
]);
