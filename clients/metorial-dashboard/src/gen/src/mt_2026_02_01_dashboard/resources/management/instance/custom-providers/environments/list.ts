import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceCustomProvidersEnvironmentsListOutput = {
  items: {
    object: 'custom_provider.environment';
    id: string;
    customProviderId: string;
    providerId: string | null;
    currentProviderVersionId: string | null;
    instanceId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceCustomProvidersEnvironmentsListOutput =
  mtMap.object<ManagementInstanceCustomProvidersEnvironmentsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          customProviderId: mtMap.objectField(
            'custom_provider_id',
            mtMap.passthrough()
          ),
          providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
          currentProviderVersionId: mtMap.objectField(
            'current_provider_version_id',
            mtMap.passthrough()
          ),
          instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
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

export type ManagementInstanceCustomProvidersEnvironmentsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  ids?: string | string[] | undefined;
  customProviderVersionIds?: string | string[] | undefined;
};

export let mapManagementInstanceCustomProvidersEnvironmentsListQuery =
  mtMap.union([
    mtMap.unionOption(
      'object',
      mtMap.object({
        limit: mtMap.objectField('limit', mtMap.passthrough()),
        after: mtMap.objectField('after', mtMap.passthrough()),
        before: mtMap.objectField('before', mtMap.passthrough()),
        cursor: mtMap.objectField('cursor', mtMap.passthrough()),
        order: mtMap.objectField('order', mtMap.passthrough()),
        ids: mtMap.objectField(
          'ids',
          mtMap.union([
            mtMap.unionOption('string', mtMap.passthrough()),
            mtMap.unionOption(
              'array',
              mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
            )
          ])
        ),
        customProviderVersionIds: mtMap.objectField(
          'custom_provider_version_ids',
          mtMap.union([
            mtMap.unionOption('string', mtMap.passthrough()),
            mtMap.unionOption(
              'array',
              mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
            )
          ])
        )
      })
    )
  ]);

