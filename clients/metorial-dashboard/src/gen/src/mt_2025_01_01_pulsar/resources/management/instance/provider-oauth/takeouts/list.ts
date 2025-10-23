import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceProviderOauthTakeoutsListOutput = {
  items: {
    object: 'provider_oauth.takeout';
    id: string;
    status: 'active' | 'expired';
    note: string | null;
    metadata: Record<string, any>;
    accessToken: string | null;
    idToken: string | null;
    scope: string | null;
    createdAt: Date;
    expiresAt: Date | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceProviderOauthTakeoutsListOutput =
  mtMap.object<ManagementInstanceProviderOauthTakeoutsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          note: mtMap.objectField('note', mtMap.passthrough()),
          metadata: mtMap.objectField('metadata', mtMap.passthrough()),
          accessToken: mtMap.objectField('access_token', mtMap.passthrough()),
          idToken: mtMap.objectField('id_token', mtMap.passthrough()),
          scope: mtMap.objectField('scope', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          expiresAt: mtMap.objectField('expires_at', mtMap.date())
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

export type ManagementInstanceProviderOauthTakeoutsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementInstanceProviderOauthTakeoutsListQuery = mtMap.union([
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

