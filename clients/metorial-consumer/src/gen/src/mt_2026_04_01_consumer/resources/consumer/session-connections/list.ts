import { createMapper } from '@metorial/util-resource-mapper/compact';

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
  /* @__PURE__ */ createMapper<ConsumerSessionConnectionsListOutput>(
    [
      7,
      [
        1,
        [
          [
            'connection',
            0,
            [
              1,
              [
                'connection_state',
                [
                  'usage',
                  0,
                  [
                    1,
                    [
                      'total_productive_client_message_count',
                      'total_productive_provider_message_count'
                    ]
                  ]
                ],
                ['mcp', 0, [1, ['protocol_version']]],
                'session_id',
                [
                  'participant',
                  0,
                  [
                    1,
                    [
                      'provider_id',
                      'connection_type',
                      'agent_id',
                      'agent_instance_id',
                      'identity_actor_id',
                      'identity_id',
                      'agent_actor_id',
                      'agent_client_id',
                      'consumer_id',
                      'created_at'
                    ]
                  ]
                ],
                'has_errors',
                'has_warnings',
                'created_at',
                'last_message_at',
                'last_active_at'
              ]
            ]
          ],
          'magic_mcp_session_id',
          'magic_mcp_endpoint_id',
          'magic_mcp_server_id'
        ]
      ]
    ],
    1
  );

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

export let mapConsumerSessionConnectionsListQuery =
  /* @__PURE__ */ createMapper<ConsumerSessionConnectionsListQuery>([
    3,
    [
      [
        0,
        [
          1,
          ['connection_state', 'agent_id', 'session_id', ['created_at', 1, 5]]
        ]
      ]
    ]
  ]);
