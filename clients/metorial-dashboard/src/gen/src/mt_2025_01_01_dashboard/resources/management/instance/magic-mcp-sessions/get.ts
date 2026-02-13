import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceMagicMcpSessionsGetOutput = {
  object: 'magic_mcp.session';
  id: string;
  subspaceSessionId: string;
  connectionStatus: string;
  connectionCount: number;
  magicMcpServer: {
    id: string;
    status: 'active' | 'archived' | 'deleted';
    name: string | null;
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
  lastActiveAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceMagicMcpSessionsGetOutput =
  mtMap.object<ManagementInstanceMagicMcpSessionsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    subspaceSessionId: mtMap.objectField(
      'subspace_session_id',
      mtMap.passthrough()
    ),
    connectionStatus: mtMap.objectField(
      'connection_status',
      mtMap.passthrough()
    ),
    connectionCount: mtMap.objectField('connection_count', mtMap.passthrough()),
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
    lastActiveAt: mtMap.objectField('last_active_at', mtMap.date()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

