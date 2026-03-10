import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSessionsConnectionsGetOutput = {
  object: 'session.connection';
  id: string;
  status: string;
  connectionState: string;
  transport: string;
  usage: {
    totalProductiveClientMessageCount: number;
    totalProductiveProviderMessageCount: number;
  };
  mcp: {
    capabilities: Record<string, any>;
    protocolVersion: string;
    transport: string;
  } | null;
  sessionId: string;
  participant: {
    object: 'session.participant';
    id: string;
    type: string;
    identifier: string;
    name: string;
    data: Record<string, any>;
    providerId: string | null;
    createdAt: Date;
  } | null;
  hasErrors: boolean;
  hasWarnings: boolean;
  createdAt: Date;
  lastMessageAt: Date;
  lastActiveAt: Date;
};

export let mapManagementInstanceSessionsConnectionsGetOutput =
  mtMap.object<ManagementInstanceSessionsConnectionsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    connectionState: mtMap.objectField('connection_state', mtMap.passthrough()),
    transport: mtMap.objectField('transport', mtMap.passthrough()),
    usage: mtMap.objectField(
      'usage',
      mtMap.object({
        totalProductiveClientMessageCount: mtMap.objectField(
          'total_productive_client_message_count',
          mtMap.passthrough()
        ),
        totalProductiveProviderMessageCount: mtMap.objectField(
          'total_productive_provider_message_count',
          mtMap.passthrough()
        )
      })
    ),
    mcp: mtMap.objectField(
      'mcp',
      mtMap.object({
        capabilities: mtMap.objectField('capabilities', mtMap.passthrough()),
        protocolVersion: mtMap.objectField(
          'protocol_version',
          mtMap.passthrough()
        ),
        transport: mtMap.objectField('transport', mtMap.passthrough())
      })
    ),
    sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
    participant: mtMap.objectField(
      'participant',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        identifier: mtMap.objectField('identifier', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        data: mtMap.objectField('data', mtMap.passthrough()),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date())
      })
    ),
    hasErrors: mtMap.objectField('has_errors', mtMap.passthrough()),
    hasWarnings: mtMap.objectField('has_warnings', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    lastMessageAt: mtMap.objectField('last_message_at', mtMap.date()),
    lastActiveAt: mtMap.objectField('last_active_at', mtMap.date())
  });

