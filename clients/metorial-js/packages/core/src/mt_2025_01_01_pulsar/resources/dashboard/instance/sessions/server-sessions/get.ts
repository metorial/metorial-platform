import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSessionsServerSessionsGetOutput = {
  object: 'session.server_session';
  id: string;
  status: 'active';
  mcp: {
    object: 'mcp';
    version: string;
    connectionType: 'sse' | 'streamable_http' | 'websocket';
    client: {
      object: 'session.server_session.client';
      name: string;
      version: string;
      capabilities: Record<string, any>;
    } | null;
    server: {
      object: 'session.server_session.server';
      name: string;
      version: string;
      capabilities: Record<string, any>;
    } | null;
  };
  usage: {
    totalProductiveMessageCount: number;
    totalProductiveClientMessageCount: number;
    totalProductiveServerMessageCount: number;
  };
  serverDeploymentId: string;
  sessionId: string;
  createdAt: Date;
};

export let mapDashboardInstanceSessionsServerSessionsGetOutput =
  mtMap.object<DashboardInstanceSessionsServerSessionsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    mcp: mtMap.objectField(
      'mcp',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        version: mtMap.objectField('version', mtMap.passthrough()),
        connectionType: mtMap.objectField(
          'connection_type',
          mtMap.passthrough()
        ),
        client: mtMap.objectField(
          'client',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            version: mtMap.objectField('version', mtMap.passthrough()),
            capabilities: mtMap.objectField('capabilities', mtMap.passthrough())
          })
        ),
        server: mtMap.objectField(
          'server',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            version: mtMap.objectField('version', mtMap.passthrough()),
            capabilities: mtMap.objectField('capabilities', mtMap.passthrough())
          })
        )
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
    serverDeploymentId: mtMap.objectField(
      'server_deployment_id',
      mtMap.passthrough()
    ),
    sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

