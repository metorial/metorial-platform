import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceToolCallsGetOutput = {
  object: 'session.tool_call';
  id: string;
  toolKey: string;
  type: 'tool_call' | 'mcp_control' | 'mcp_message' | 'unknown';
  status: 'waiting_for_response' | 'failed' | 'succeeded';
  source: 'client' | 'provider';
  transport: 'tool_call' | 'mcp' | 'metorial_protocol' | 'system';
  sessionId: string;
  messageId: string;
  sessionProviderId: string | null;
  connectionId: string | null;
  providerRunId: string | null;
  senderParticipant: {
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
  responderParticipant: {
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
  tool: {
    object: 'provider.tool';
    id: string;
    key: string;
    name: string;
    description: string | null;
    capabilities: Record<string, any>;
    constraints: string[];
    instructions: string[];
    inputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
    outputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
    tags: { destructive: boolean | null; readOnly: boolean | null } | null;
    toolCategoryKeys: string[];
    specificationId: string;
    providerId: string;
    createdAt: Date;
    updatedAt: Date;
  };
  error: {
    object: 'session.error';
    id: string;
    code: string;
    message: string;
    data: Record<string, any>;
    status: 'processing' | 'processed';
    sessionId: string;
    providerRunId: string | null;
    connectionId: string | null;
    groupId: string | null;
    similarErrorCount: number;
    createdAt: Date;
  } | null;
  input: Record<string, any> | null;
  output: Record<string, any> | null;
  createdAt: Date;
};

export let mapDashboardInstanceToolCallsGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceToolCallsGetOutput>(
    [
      'tool_key',
      'session_id',
      'message_id',
      'session_provider_id',
      'connection_id',
      'provider_run_id',
      [
        'sender_participant',
        1,
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
      [
        'responder_participant',
        1,
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
      [
        'tool',
        0,
        [
          1,
          [
            'input_schema',
            'output_schema',
            ['tags', 0, [1, ['read_only']]],
            'tool_category_keys',
            'specification_id',
            'provider_id',
            'created_at',
            'updated_at'
          ]
        ]
      ],
      [
        'error',
        0,
        [
          1,
          [
            'session_id',
            'provider_run_id',
            'connection_id',
            'group_id',
            'similar_error_count',
            'created_at'
          ]
        ]
      ],
      'created_at'
    ],
    1
  );
