import { mapObject } from '@metorial/util-resource-mapper/compact';

export type SessionsConnectionsGetOutput = {
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
    transport: 'none' | 'sse' | 'streamable_http' | 'sessionless';
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

export let mapSessionsConnectionsGetOutput =
  /* @__PURE__ */ mapObject<SessionsConnectionsGetOutput>(
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
    ],
    1
  );
