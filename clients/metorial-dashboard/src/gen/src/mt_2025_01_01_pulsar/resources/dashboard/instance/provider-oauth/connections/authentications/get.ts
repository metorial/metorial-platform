import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProviderOauthConnectionsAuthenticationsGetOutput =
  {
    object: 'provider_oauth.connection.profile';
    id: string;
    status: 'completed' | 'failed' | 'provider_disabled';
    error: { code: string; message: string | null } | null;
    events: {
      id: string;
      type:
        | 'authentication_completed'
        | 'authentication_error'
        | 'provider_token_disabled_error';
      metadata: Record<string, any>;
      createdAt: Date;
    }[];
    connectionId: string;
    profile: {
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
    };
    createdAt: Date;
  };

export let mapDashboardInstanceProviderOauthConnectionsAuthenticationsGetOutput =
  mtMap.object<DashboardInstanceProviderOauthConnectionsAuthenticationsGetOutput>(
    {
      object: mtMap.objectField('object', mtMap.passthrough()),
      id: mtMap.objectField('id', mtMap.passthrough()),
      status: mtMap.objectField('status', mtMap.passthrough()),
      error: mtMap.objectField(
        'error',
        mtMap.object({
          code: mtMap.objectField('code', mtMap.passthrough()),
          message: mtMap.objectField('message', mtMap.passthrough())
        })
      ),
      events: mtMap.objectField(
        'events',
        mtMap.array(
          mtMap.object({
            id: mtMap.objectField('id', mtMap.passthrough()),
            type: mtMap.objectField('type', mtMap.passthrough()),
            metadata: mtMap.objectField('metadata', mtMap.passthrough()),
            createdAt: mtMap.objectField('created_at', mtMap.date())
          })
        )
      ),
      connectionId: mtMap.objectField('connection_id', mtMap.passthrough()),
      profile: mtMap.objectField(
        'profile',
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
      ),
      createdAt: mtMap.objectField('created_at', mtMap.date())
    }
  );

