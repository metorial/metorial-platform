import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceServersListingsListOutput = {
  items: {
    id: string;
    status: 'active' | 'archived' | 'banned';
    slug: string;
    name: string;
    description: string;
    readme: string;
    serverId: string;
    categories: {
      id: string;
      name: string;
      slug: string;
      description: string;
      createdAt: Date;
      updatedAt: Date;
    }[];
    isOfficial: boolean;
    isCommunity: boolean;
    isHostable: boolean;
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
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceServersListingsListOutput =
  mtMap.object<DashboardInstanceServersListingsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          slug: mtMap.objectField('slug', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          readme: mtMap.objectField('readme', mtMap.passthrough()),
          serverId: mtMap.objectField('server_id', mtMap.passthrough()),
          categories: mtMap.objectField(
            'categories',
            mtMap.array(
              mtMap.object({
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
          isOfficial: mtMap.objectField('is_official', mtMap.passthrough()),
          isCommunity: mtMap.objectField('is_community', mtMap.passthrough()),
          isHostable: mtMap.objectField('is_hostable', mtMap.passthrough()),
          vendor: mtMap.objectField(
            'vendor',
            mtMap.object({
              id: mtMap.objectField('id', mtMap.passthrough()),
              identifier: mtMap.objectField('identifier', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
              attributes: mtMap.objectField('attributes', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          repository: mtMap.objectField(
            'repository',
            mtMap.object({
              id: mtMap.objectField('id', mtMap.passthrough()),
              identifier: mtMap.objectField('identifier', mtMap.passthrough()),
              slug: mtMap.objectField('slug', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              providerUrl: mtMap.objectField(
                'provider_url',
                mtMap.passthrough()
              ),
              websiteUrl: mtMap.objectField('website_url', mtMap.passthrough()),
              provider: mtMap.objectField('provider', mtMap.passthrough()),
              starCount: mtMap.objectField('star_count', mtMap.passthrough()),
              forkCount: mtMap.objectField('fork_count', mtMap.passthrough()),
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
              licenseUrl: mtMap.objectField('license_url', mtMap.passthrough()),
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
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
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

export type DashboardInstanceServersListingsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  search?: string | undefined;
  collectionIds?: string[] | undefined;
  categoryIds?: string[] | undefined;
  profileIds?: string[] | undefined;
};

export let mapDashboardInstanceServersListingsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      search: mtMap.objectField('search', mtMap.passthrough()),
      collectionIds: mtMap.objectField(
        'collection_ids',
        mtMap.array(mtMap.passthrough())
      ),
      categoryIds: mtMap.objectField(
        'category_ids',
        mtMap.array(mtMap.passthrough())
      ),
      profileIds: mtMap.objectField(
        'profile_ids',
        mtMap.array(mtMap.passthrough())
      )
    })
  )
]);

