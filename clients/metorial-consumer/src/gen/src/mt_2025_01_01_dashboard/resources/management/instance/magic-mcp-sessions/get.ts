import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceMagicMcpSessionsGetOutput = {
  object: 'magic_mcp.session';
  id: string;
  sessionId: string;
  connectionStatus: 'connected' | 'disconnected';
  magicMcpServer: {
    id: string;
    status: 'active' | 'archived' | 'deleted';
    name: string;
    description: string | null;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
  };
  usage: {
    totalProductiveMessageCount: number;
    totalProductiveClientMessageCount: number;
    totalProductiveServerMessageCount: number;
  };
  client: {
    object: 'session.client#preview';
    info: { name: string; version: string };
  } | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceMagicMcpSessionsGetOutput =
  mtMap.object<ManagementInstanceMagicMcpSessionsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
    connectionStatus: mtMap.objectField(
      'connection_status',
      mtMap.passthrough()
    ),
    magicMcpServer: mtMap.objectField(
      'magic_mcp_server',
      mtMap.object({
        id: mtMap.objectField('id', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
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
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

