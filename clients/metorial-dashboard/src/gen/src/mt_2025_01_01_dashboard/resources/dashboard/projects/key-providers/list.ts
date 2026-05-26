import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardProjectsKeyProvidersListOutput = {
  items: {
    object: 'key_provider';
    id: string;
    name: string;
    type: 'aws_kms' | 'local';
    owner: 'tenant' | 'system';
    status: 'active' | 'inactive' | 'degraded';
    isMetorialManaged: boolean;
    keyReuseTimeSeconds: number | null;
    keyInfo: Record<string, any>;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardProjectsKeyProvidersListOutput =
  mtMap.object<DashboardProjectsKeyProvidersListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          owner: mtMap.objectField('owner', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          isMetorialManaged: mtMap.objectField(
            'is_metorial_managed',
            mtMap.passthrough()
          ),
          keyReuseTimeSeconds: mtMap.objectField(
            'key_reuse_time_seconds',
            mtMap.passthrough()
          ),
          keyInfo: mtMap.objectField('key_info', mtMap.passthrough()),
          isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
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

export type DashboardProjectsKeyProvidersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardProjectsKeyProvidersListQuery = mtMap.union([
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

