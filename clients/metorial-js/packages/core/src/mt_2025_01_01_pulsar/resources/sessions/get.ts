import { mtMap } from '@metorial/util-resource-mapper';

export type SessionsGetOutput = {
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
    object: 'server.server_deployment#preview';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    name: string;
    description: string | null;
    metadata: Record<string, any>;
    secretId: string;
    server: {
      object: 'server#preview';
      id: string;
      name: string;
      description: string | null;
      type: 'public';
      createdAt: Date;
      updatedAt: Date;
    };
    createdAt: Date;
    updatedAt: Date;
  }[];
  usage: {
    totalProductiveMessageCount: number;
    totalProductiveClientMessageCount: number;
    totalProductiveServerMessageCount: number;
  };
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
};

export let mapSessionsGetOutput = mtMap.object<SessionsGetOutput>({
  object: mtMap.objectField('object', mtMap.passthrough()),
  id: mtMap.objectField('id', mtMap.passthrough()),
  status: mtMap.objectField('status', mtMap.passthrough()),
  connectionStatus: mtMap.objectField('connection_status', mtMap.passthrough()),
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
        status: mtMap.objectField('status', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        secretId: mtMap.objectField('secret_id', mtMap.passthrough()),
        server: mtMap.objectField(
          'server',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            description: mtMap.objectField('description', mtMap.passthrough()),
            type: mtMap.objectField('type', mtMap.passthrough()),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date())
          })
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
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
  updatedAt: mtMap.objectField('updated_at', mtMap.date())
});

