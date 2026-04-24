import { mtMap } from '@metorial/util-resource-mapper';

export type ProviderAuthConfigErrorsListOutput = {
  items: {
    object: 'provider.auth_config_error';
    id: string;
    status: 'processing' | 'processed';
    type: string;
    code: string;
    message: string;
    authConfigEventId: string | null;
    providerAuthConfigId: string | null;
    providerAuthCredentialsId: string | null;
    providerOauthSetupId: string | null;
    providerId: string;
    providerInvocationId: string | null;
    groupId: string | null;
    similarErrorCount: number;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapProviderAuthConfigErrorsListOutput =
  mtMap.object<ProviderAuthConfigErrorsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          code: mtMap.objectField('code', mtMap.passthrough()),
          message: mtMap.objectField('message', mtMap.passthrough()),
          authConfigEventId: mtMap.objectField(
            'auth_config_event_id',
            mtMap.passthrough()
          ),
          providerAuthConfigId: mtMap.objectField(
            'provider_auth_config_id',
            mtMap.passthrough()
          ),
          providerAuthCredentialsId: mtMap.objectField(
            'provider_auth_credentials_id',
            mtMap.passthrough()
          ),
          providerOauthSetupId: mtMap.objectField(
            'provider_oauth_setup_id',
            mtMap.passthrough()
          ),
          providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
          providerInvocationId: mtMap.objectField(
            'provider_invocation_id',
            mtMap.passthrough()
          ),
          groupId: mtMap.objectField('group_id', mtMap.passthrough()),
          similarErrorCount: mtMap.objectField(
            'similar_error_count',
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

export type ProviderAuthConfigErrorsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  authConfigEventId?: string | string[] | undefined;
  providerAuthConfigId?: string | string[] | undefined;
  providerAuthCredentialsId?: string | string[] | undefined;
  providerOauthSetupId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  providerAuthConfigErrorGroupId?: string | string[] | undefined;
  providerInvocationId?: string | string[] | undefined;
  type?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapProviderAuthConfigErrorsListQuery = mtMap.union([
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
      authConfigEventId: mtMap.objectField(
        'auth_config_event_id',
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
      providerOauthSetupId: mtMap.objectField(
        'provider_oauth_setup_id',
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
      providerAuthConfigErrorGroupId: mtMap.objectField(
        'provider_auth_config_error_group_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      providerInvocationId: mtMap.objectField(
        'provider_invocation_id',
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

