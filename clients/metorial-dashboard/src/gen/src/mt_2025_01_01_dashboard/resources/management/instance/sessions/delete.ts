import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSessionsDeleteOutput = {
  object: 'session';
  id: string;
  status: 'active' | 'deleted';
  connectionStatus: 'connected' | 'disconnected';
  clientSecret: {
    object: 'client_secret';
    type: 'session';
    id: string;
    secret: string;
    expiresAt: Date;
  };
  serverDeployments: {
    object: 'session.server_deployment#preview';
    id: string;
    name: string | null;
    oauthSessionId: string | null;
    description: string | null;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
    server: {
      object: 'server#preview';
      id: string;
      name: string;
      description: string | null;
      type: 'public' | 'custom';
      createdAt: Date;
      updatedAt: Date;
    };
    connectionUrls: { sse: string; streamableHttp: string; websocket: string };
  }[];
  usage: {
    totalProductiveMessageCount: number;
    totalProductiveClientMessageCount: number;
    totalProductiveServerMessageCount: number;
  };
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
} & {
  client: {
    object: 'session.client#preview';
    info: { name: string; version: string };
  } | null;
};

export let mapManagementInstanceSessionsDeleteOutput = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      object: mtMap.objectField('object', mtMap.passthrough()),
      id: mtMap.objectField('id', mtMap.passthrough()),
      status: mtMap.objectField('status', mtMap.passthrough()),
      connectionStatus: mtMap.objectField(
        'connection_status',
        mtMap.passthrough()
      ),
      clientSecret: mtMap.objectField(
        'client_secret',
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          secret: mtMap.objectField('secret', mtMap.passthrough()),
          expiresAt: mtMap.objectField('expires_at', mtMap.date())
        })
      ),
      serverDeployments: mtMap.objectField(
        'server_deployments',
        mtMap.array(
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            oauthSessionId: mtMap.objectField(
              'oauth_session_id',
              mtMap.passthrough()
            ),
            description: mtMap.objectField('description', mtMap.passthrough()),
            metadata: mtMap.objectField('metadata', mtMap.passthrough()),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date()),
            server: mtMap.objectField(
              'server',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                description: mtMap.objectField(
                  'description',
                  mtMap.passthrough()
                ),
                type: mtMap.objectField('type', mtMap.passthrough()),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date())
              })
            ),
            connectionUrls: mtMap.objectField(
              'connection_urls',
              mtMap.object({
                sse: mtMap.objectField('sse', mtMap.passthrough()),
                streamableHttp: mtMap.objectField(
                  'streamable_http',
                  mtMap.passthrough()
                ),
                websocket: mtMap.objectField('websocket', mtMap.passthrough())
              })
            )
          })
        )
      ),
      usage: mtMap.objectField(
        'usage',
        mtMap.object({
          totalProductiveMessageCount: mtMap.objectField(
            'total_productive_message_count',
            mtMap.passthrough()
          ),
          totalProductiveClientMessageCount: mtMap.objectField(
            'total_productive_client_message_count',
            mtMap.passthrough()
          ),
          totalProductiveServerMessageCount: mtMap.objectField(
            'total_productive_server_message_count',
            mtMap.passthrough()
          )
        })
      ),
      metadata: mtMap.objectField('metadata', mtMap.passthrough()),
      createdAt: mtMap.objectField('created_at', mtMap.date()),
      updatedAt: mtMap.objectField('updated_at', mtMap.date()),
      client: mtMap.objectField(
        'client',
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          info: mtMap.objectField(
            'info',
            mtMap.object({
              name: mtMap.objectField('name', mtMap.passthrough()),
              version: mtMap.objectField('version', mtMap.passthrough())
            })
          )
        })
      )
    })
  )
]);

