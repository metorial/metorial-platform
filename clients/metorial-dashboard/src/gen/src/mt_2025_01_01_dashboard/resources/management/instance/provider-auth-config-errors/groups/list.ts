import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceProviderAuthConfigErrorsGroupsListOutput = {
  items: {
    object: 'provider.auth_config_error_group';
    id: string;
    type: string;
    code: string;
    message: string;
    providerId: string;
    occurrenceCount: number;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceProviderAuthConfigErrorsGroupsListOutput =
  mtMap.object<ManagementInstanceProviderAuthConfigErrorsGroupsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          code: mtMap.objectField('code', mtMap.passthrough()),
          message: mtMap.objectField('message', mtMap.passthrough()),
          providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
          occurrenceCount: mtMap.objectField(
            'occurrence_count',
            mtMap.passthrough()
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date())
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

export type ManagementInstanceProviderAuthConfigErrorsGroupsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  providerAuthConfigId?: string | string[] | undefined;
  providerAuthCredentialsId?: string | string[] | undefined;
  type?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapManagementInstanceProviderAuthConfigErrorsGroupsListQuery =
  mtMap.union([
    mtMap.unionOption(
      'object',
      mtMap.object({
        limit: mtMap.objectField('limit', mtMap.passthrough()),
        after: mtMap.objectField('after', mtMap.passthrough()),
        before: mtMap.objectField('before', mtMap.passthrough()),
        cursor: mtMap.objectField('cursor', mtMap.passthrough()),
        order: mtMap.objectField('order', mtMap.passthrough()),
        id: mtMap.objectField(
          'id',
          mtMap.union([
            mtMap.unionOption('string', mtMap.passthrough()),
            mtMap.unionOption(
              'array',
              mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
            )
          ])
        ),
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
        providerAuthConfigId: mtMap.objectField(
          'provider_auth_config_id',
          mtMap.union([
            mtMap.unionOption('string', mtMap.passthrough()),
            mtMap.unionOption(
              'array',
              mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
            )
          ])
        ),
        providerAuthCredentialsId: mtMap.objectField(
          'provider_auth_credentials_id',
          mtMap.union([
            mtMap.unionOption('string', mtMap.passthrough()),
            mtMap.unionOption(
              'array',
              mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
            )
          ])
        ),
        type: mtMap.objectField(
          'type',
          mtMap.union([
            mtMap.unionOption('string', mtMap.passthrough()),
            mtMap.unionOption(
              'array',
              mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
            )
          ])
        ),
        createdAt: mtMap.objectField(
          'created_at',
          mtMap.object({
            gt: mtMap.objectField('gt', mtMap.date()),
            lt: mtMap.objectField('lt', mtMap.date())
          })
        )
      })
    )
  ]);

