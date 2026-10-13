import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSandboxImagesListOutput = {
  items: {
    object: 'sandbox.image';
    id: string;
    owner: 'own' | 'global';
    status: 'pending' | 'active' | 'deleted';
    name: string | null;
    identifier: string | null;
    regions: string[];
    latestVersionId: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSandboxImagesListOutput =
  mtMap.object<DashboardInstanceSandboxImagesListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          owner: mtMap.objectField('owner', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          identifier: mtMap.objectField('identifier', mtMap.passthrough()),
          regions: mtMap.objectField(
            'regions',
            mtMap.array(mtMap.passthrough())
          ),
          latestVersionId: mtMap.objectField(
            'latest_version_id',
            mtMap.passthrough()
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date()),
          deletedAt: mtMap.objectField('deleted_at', mtMap.date())
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

export type DashboardInstanceSandboxImagesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  owner?: 'own' | 'global' | ('own' | 'global')[] | undefined;
  status?:
    | 'pending'
    | 'active'
    | 'deleted'
    | ('pending' | 'active' | 'deleted')[]
    | undefined;
  search?: string | undefined;
};

export let mapDashboardInstanceSandboxImagesListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      owner: mtMap.objectField(
        'owner',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      ),
      status: mtMap.objectField(
        'status',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      ),
      search: mtMap.objectField('search', mtMap.passthrough())
    })
  )
]);

