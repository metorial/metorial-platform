import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceProviderOauthSessionsListOutput = {
  items: {
    object: 'provider_oauth.session';
    id: string;
    status: 'pending' | 'opened' | 'completed' | 'failed';
    url: string;
    connection: {
      object: 'provider_oauth.connection';
      id: string;
      status: 'active' | 'archived';
      name: string;
      description: string | null;
      metadata: Record<string, any>;
      provider: { id: string; name: string; url: string; imageUrl: string };
      config: Record<string, any>;
      scopes: string[];
      clientId: string;
      instanceId: string;
      templateId: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
    metadata: Record<string, any>;
    redirectUri: string | null;
    instanceId: string;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceProviderOauthSessionsListOutput =
  mtMap.object<ManagementInstanceProviderOauthSessionsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          url: mtMap.objectField('url', mtMap.passthrough()),
          connection: mtMap.objectField(
            'connection',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              metadata: mtMap.objectField('metadata', mtMap.passthrough()),
              provider: mtMap.objectField(
                'provider',
                mtMap.object({
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  url: mtMap.objectField('url', mtMap.passthrough()),
                  imageUrl: mtMap.objectField('image_url', mtMap.passthrough())
                })
              ),
              config: mtMap.objectField('config', mtMap.passthrough()),
              scopes: mtMap.objectField(
                'scopes',
                mtMap.array(mtMap.passthrough())
              ),
              clientId: mtMap.objectField('client_id', mtMap.passthrough()),
              instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
              templateId: mtMap.objectField('template_id', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          metadata: mtMap.objectField('metadata', mtMap.passthrough()),
          redirectUri: mtMap.objectField('redirect_uri', mtMap.passthrough()),
          instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
          completedAt: mtMap.objectField('completed_at', mtMap.date()),
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

export type ManagementInstanceProviderOauthSessionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementInstanceProviderOauthSessionsListQuery = mtMap.union([
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

