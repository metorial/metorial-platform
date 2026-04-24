import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProviderAuthConfigEventsListOutput = {
  items: {
    object: 'provider.auth_config_event';
    id: string;
    type: string;
    status: 'success' | 'error';
    sourceType: string;
    sourceId: string;
    providerAuthConfigId: string | null;
    providerAuthCredentialsId: string | null;
    providerOauthSetupId: string | null;
    providerId: string;
    providerAuthErrorId: string | null;
    providerInvocationId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceProviderAuthConfigEventsListOutput =
  mtMap.object<DashboardInstanceProviderAuthConfigEventsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          sourceType: mtMap.objectField('source_type', mtMap.passthrough()),
          sourceId: mtMap.objectField('source_id', mtMap.passthrough()),
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
          providerAuthErrorId: mtMap.objectField(
            'provider_auth_error_id',
            mtMap.passthrough()
          ),
          providerInvocationId: mtMap.objectField(
            'provider_invocation_id',
            mtMap.passthrough()
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

export type DashboardInstanceProviderAuthConfigEventsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  providerAuthConfigId?: string | string[] | undefined;
  providerAuthCredentialsId?: string | string[] | undefined;
  providerOauthSetupId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  providerInvocationId?: string | string[] | undefined;
  type?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapDashboardInstanceProviderAuthConfigEventsListQuery = mtMap.union([
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
      ),
      updatedAt: mtMap.objectField(
        'updated_at',
        mtMap.object({
          gt: mtMap.objectField('gt', mtMap.date()),
          lt: mtMap.objectField('lt', mtMap.date())
        })
      )
    })
  )
]);

