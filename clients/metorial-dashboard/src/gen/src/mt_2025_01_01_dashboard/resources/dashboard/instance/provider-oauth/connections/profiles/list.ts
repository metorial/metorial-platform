import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProviderOauthConnectionsProfilesListOutput = {
  items: {
    object: 'provider_oauth.connection.profile';
    id: string;
    status: 'active';
    sub: string;
    name: string | null;
    email: string | null;
    connectionId: string;
    createdAt: Date;
    lastUsedAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceProviderOauthConnectionsProfilesListOutput =
  mtMap.object<DashboardInstanceProviderOauthConnectionsProfilesListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          sub: mtMap.objectField('sub', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          email: mtMap.objectField('email', mtMap.passthrough()),
          connectionId: mtMap.objectField('connection_id', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          lastUsedAt: mtMap.objectField('last_used_at', mtMap.date()),
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

export type DashboardInstanceProviderOauthConnectionsProfilesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardInstanceProviderOauthConnectionsProfilesListQuery =
  mtMap.union([
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

