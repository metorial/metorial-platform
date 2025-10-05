import { mtMap } from '@metorial/util-resource-mapper';

export type ServersListingsListOutput = {
  items: ({
    object: 'server_listing';
    id: string;
    status: 'active' | 'archived' | 'banned';
    slug: string;
    imageUrl: string;
    profile: {
      object: 'profile';
      id: string;
      name: string;
      description: string | null;
      slug: string;
      imageUrl: string;
      isOfficial: boolean;
      isMetorial: boolean;
      isVerified: boolean;
      badges: { type: 'system' | 'staff'; name: string }[];
      createdAt: Date;
      updatedAt: Date;
    } | null;
    name: string;
    description: string;
    readme: string;
    categories: {
      object: 'server_listing.category';
      id: string;
      name: string;
      slug: string;
      description: string;
      createdAt: Date;
      updatedAt: Date;
    }[];
    skills: string[];
    isOfficial: boolean;
    isCommunity: boolean;
    isHostable: boolean;
    isMetorial: boolean;
    isVerified: boolean;
    server: {
      object: 'server#preview';
      id: string;
      name: string;
      description: string | null;
      type: 'public' | 'custom';
      createdAt: Date;
      updatedAt: Date;
    };
    vendor: {
      id: string;
      identifier: string;
      name: string;
      description: string | null;
      imageUrl: string;
      attributes?: any | undefined;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    repository: {
      id: string;
      identifier: string;
      slug: string;
      name: string;
      providerUrl: string;
      websiteUrl: string;
      provider: string;
      starCount: number;
      forkCount: number;
      watcherCount: number;
      openIssuesCount: number;
      subscriptionCount: number;
      defaultBranch: string;
      licenseName: string;
      licenseUrl: string;
      licenseSpdxId: string;
      topics: string[];
      language: string | null;
      description: string | null;
      createdAt: Date;
      updatedAt: Date;
      pushedAt: Date | null;
    } | null;
    installation: { id: string; instanceId: string; createdAt: Date } | null;
    createdAt: Date;
    updatedAt: Date;
  } & { oauthExplainer: string | null; readmeHtml: string | null })[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapServersListingsListOutput =
  mtMap.object<ServersListingsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.union([
          mtMap.unionOption(
            'object',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              slug: mtMap.objectField('slug', mtMap.passthrough()),
              imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
              profile: mtMap.objectField(
                'profile',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  description: mtMap.objectField(
                    'description',
                    mtMap.passthrough()
                  ),
                  slug: mtMap.objectField('slug', mtMap.passthrough()),
                  imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
                  isOfficial: mtMap.objectField(
                    'is_official',
                    mtMap.passthrough()
                  ),
                  isMetorial: mtMap.objectField(
                    'is_metorial',
                    mtMap.passthrough()
                  ),
                  isVerified: mtMap.objectField(
                    'is_verified',
                    mtMap.passthrough()
                  ),
                  badges: mtMap.objectField(
                    'badges',
                    mtMap.array(
                      mtMap.object({
                        type: mtMap.objectField('type', mtMap.passthrough()),
                        name: mtMap.objectField('name', mtMap.passthrough())
                      })
                    )
                  ),
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date())
                })
              ),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              readme: mtMap.objectField('readme', mtMap.passthrough()),
              categories: mtMap.objectField(
                'categories',
                mtMap.array(
                  mtMap.object({
                    object: mtMap.objectField('object', mtMap.passthrough()),
                    id: mtMap.objectField('id', mtMap.passthrough()),
                    name: mtMap.objectField('name', mtMap.passthrough()),
                    slug: mtMap.objectField('slug', mtMap.passthrough()),
                    description: mtMap.objectField(
                      'description',
                      mtMap.passthrough()
                    ),
                    createdAt: mtMap.objectField('created_at', mtMap.date()),
                    updatedAt: mtMap.objectField('updated_at', mtMap.date())
                  })
                )
              ),
              skills: mtMap.objectField(
                'skills',
                mtMap.array(mtMap.passthrough())
              ),
              isOfficial: mtMap.objectField('is_official', mtMap.passthrough()),
              isCommunity: mtMap.objectField(
                'is_community',
                mtMap.passthrough()
              ),
              isHostable: mtMap.objectField('is_hostable', mtMap.passthrough()),
              isMetorial: mtMap.objectField('is_metorial', mtMap.passthrough()),
              isVerified: mtMap.objectField('is_verified', mtMap.passthrough()),
              server: mtMap.objectField(
                'server',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  description: mtMap.objectField(
                    'description',
                    mtMap.passthrough()
                  ),
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date())
                })
              ),
              vendor: mtMap.objectField(
                'vendor',
                mtMap.object({
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  identifier: mtMap.objectField(
                    'identifier',
                    mtMap.passthrough()
                  ),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  description: mtMap.objectField(
                    'description',
                    mtMap.passthrough()
                  ),
                  imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
                  attributes: mtMap.objectField(
                    'attributes',
                    mtMap.passthrough()
                  ),
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date())
                })
              ),
              repository: mtMap.objectField(
                'repository',
                mtMap.object({
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  identifier: mtMap.objectField(
                    'identifier',
                    mtMap.passthrough()
                  ),
                  slug: mtMap.objectField('slug', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  providerUrl: mtMap.objectField(
                    'provider_url',
                    mtMap.passthrough()
                  ),
                  websiteUrl: mtMap.objectField(
                    'website_url',
                    mtMap.passthrough()
                  ),
                  provider: mtMap.objectField('provider', mtMap.passthrough()),
                  starCount: mtMap.objectField(
                    'star_count',
                    mtMap.passthrough()
                  ),
                  forkCount: mtMap.objectField(
                    'fork_count',
                    mtMap.passthrough()
                  ),
                  watcherCount: mtMap.objectField(
                    'watcher_count',
                    mtMap.passthrough()
                  ),
                  openIssuesCount: mtMap.objectField(
                    'open_issues_count',
                    mtMap.passthrough()
                  ),
                  subscriptionCount: mtMap.objectField(
                    'subscription_count',
                    mtMap.passthrough()
                  ),
                  defaultBranch: mtMap.objectField(
                    'default_branch',
                    mtMap.passthrough()
                  ),
                  licenseName: mtMap.objectField(
                    'license_name',
                    mtMap.passthrough()
                  ),
                  licenseUrl: mtMap.objectField(
                    'license_url',
                    mtMap.passthrough()
                  ),
                  licenseSpdxId: mtMap.objectField(
                    'license_spdx_id',
                    mtMap.passthrough()
                  ),
                  topics: mtMap.objectField(
                    'topics',
                    mtMap.array(mtMap.passthrough())
                  ),
                  language: mtMap.objectField('language', mtMap.passthrough()),
                  description: mtMap.objectField(
                    'description',
                    mtMap.passthrough()
                  ),
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date()),
                  pushedAt: mtMap.objectField('pushed_at', mtMap.date())
                })
              ),
              installation: mtMap.objectField(
                'installation',
                mtMap.object({
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  instanceId: mtMap.objectField(
                    'instance_id',
                    mtMap.passthrough()
                  ),
                  createdAt: mtMap.objectField('created_at', mtMap.date())
                })
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date()),
              oauthExplainer: mtMap.objectField(
                'oauth_explainer',
                mtMap.passthrough()
              ),
              readmeHtml: mtMap.objectField('readme_html', mtMap.passthrough())
            })
          )
        ])
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

export type ServersListingsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  search?: string | undefined;
  collectionId?: string[] | string | undefined;
  categoryId?: string[] | string | undefined;
  profileId?: string[] | string | undefined;
  instanceId?: string | undefined;
  orderByRank?: boolean | undefined;
  isPublic?: boolean | undefined;
  onlyFromOrganization?: boolean | undefined;
};

export let mapServersListingsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      search: mtMap.objectField('search', mtMap.passthrough()),
      collectionId: mtMap.objectField(
        'collection_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      categoryId: mtMap.objectField(
        'category_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      profileId: mtMap.objectField(
        'profile_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
      orderByRank: mtMap.objectField('order_by_rank', mtMap.passthrough()),
      isPublic: mtMap.objectField('is_public', mtMap.passthrough()),
      onlyFromOrganization: mtMap.objectField(
        'only_from_organization',
        mtMap.passthrough()
      )
    })
  )
]);

