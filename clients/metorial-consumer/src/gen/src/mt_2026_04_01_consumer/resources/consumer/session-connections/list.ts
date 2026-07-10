import { mtMap } from '@metorial/util-resource-mapper';

export type ConsumerSessionConnectionsListOutput = {
  items: {
    object: 'consumer.activity_session_connection';
    connection: {
      object: 'session.connection';
      id: string;
      connectionState: 'connected' | 'disconnected';
      transport: 'mcp' | 'tool_call' | 'metorial_protocol' | 'system';
      usage: {
        totalProductiveClientMessageCount: number;
        totalProductiveProviderMessageCount: number;
      };
      mcp: {
        capabilities: Record<string, any>;
        protocolVersion: string;
        transport: 'none' | 'sse' | 'streamable_http';
      } | null;
      sessionId: string;
      participant: {
        object: 'session.participant';
        id: string;
        type: 'unknown' | 'provider' | 'agent' | 'system';
        identifier: string;
        name: string;
        data: { identifier: string; name: string };
        providerId: string | null;
        connectionType: 'mcp' | 'metorial_protocol' | 'tool_call' | null;
        agentId: string | null;
        agentInstanceId: string | null;
        identityActorId: string | null;
        identityId: string | null;
        agentActorId: string | null;
        agentClientId: string | null;
        consumerId: string | null;
        createdAt: Date;
      } | null;
      hasErrors: boolean;
      hasWarnings: boolean;
      createdAt: Date;
      lastMessageAt: Date;
      lastActiveAt: Date | null;
    };
    magicMcpSessionId: string | null;
    magicMcpEndpointId: string | null;
    magicMcpServerId: string | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapConsumerSessionConnectionsListOutput =
  mtMap.object<ConsumerSessionConnectionsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          connection: mtMap.objectField(
            'connection',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              connectionState: mtMap.objectField(
                'connection_state',
                mtMap.passthrough()
              ),
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
                  capabilities: mtMap.objectField(
                    'capabilities',
                    mtMap.passthrough()
                  ),
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
                  identifier: mtMap.objectField(
                    'identifier',
                    mtMap.passthrough()
                  ),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  data: mtMap.objectField(
                    'data',
                    mtMap.object({
                      identifier: mtMap.objectField(
                        'identifier',
                        mtMap.passthrough()
                      ),
                      name: mtMap.objectField('name', mtMap.passthrough())
                    })
                  ),
                  providerId: mtMap.objectField(
                    'provider_id',
                    mtMap.passthrough()
                  ),
                  connectionType: mtMap.objectField(
                    'connection_type',
                    mtMap.passthrough()
                  ),
                  agentId: mtMap.objectField('agent_id', mtMap.passthrough()),
                  agentInstanceId: mtMap.objectField(
                    'agent_instance_id',
                    mtMap.passthrough()
                  ),
                  identityActorId: mtMap.objectField(
                    'identity_actor_id',
                    mtMap.passthrough()
                  ),
                  identityId: mtMap.objectField(
                    'identity_id',
                    mtMap.passthrough()
                  ),
                  agentActorId: mtMap.objectField(
                    'agent_actor_id',
                    mtMap.passthrough()
                  ),
                  agentClientId: mtMap.objectField(
                    'agent_client_id',
                    mtMap.passthrough()
                  ),
                  consumerId: mtMap.objectField(
                    'consumer_id',
                    mtMap.passthrough()
                  ),
                  createdAt: mtMap.objectField('created_at', mtMap.date())
                })
              ),
              hasErrors: mtMap.objectField('has_errors', mtMap.passthrough()),
              hasWarnings: mtMap.objectField(
                'has_warnings',
                mtMap.passthrough()
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              lastMessageAt: mtMap.objectField('last_message_at', mtMap.date()),
              lastActiveAt: mtMap.objectField('last_active_at', mtMap.date())
            })
          ),
          magicMcpSessionId: mtMap.objectField(
            'magic_mcp_session_id',
            mtMap.passthrough()
          ),
          magicMcpEndpointId: mtMap.objectField(
            'magic_mcp_endpoint_id',
            mtMap.passthrough()
          ),
          magicMcpServerId: mtMap.objectField(
            'magic_mcp_server_id',
            mtMap.passthrough()
          )
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

export type ConsumerSessionConnectionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  connectionState?:
    | 'connected'
    | 'disconnected'
    | ('connected' | 'disconnected')[]
    | undefined;
  agentId?: string | undefined;
  sessionId?: string | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapConsumerSessionConnectionsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      connectionState: mtMap.objectField(
        'connection_state',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      ),
      agentId: mtMap.objectField('agent_id', mtMap.passthrough()),
      sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
      createdAt: mtMap.objectField(
        'created_at',
        mtMap.object({
          gt: mtMap.objectField('gt', mtMap.date()),
          lt: mtMap.objectField('lt', mtMap.date())
        })
      )
    })
  )
]);

