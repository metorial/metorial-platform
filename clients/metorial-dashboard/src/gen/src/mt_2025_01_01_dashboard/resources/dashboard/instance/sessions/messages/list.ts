import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSessionsMessagesListOutput = {
  items: {
    object: 'session.message';
    id: string;
    type: 'tool_call' | 'mcp_control' | 'mcp_message' | 'unknown';
    status: 'waiting_for_response' | 'failed' | 'succeeded';
    source: 'client' | 'provider';
    sessionId: string;
    sessionProviderId: string | null;
    connectionId: string | null;
    providerRunId: string | null;
    hierarchy: {
      object: 'session.message.hierarchy';
      type: string;
      parentMessageId: string | null;
      childMessageIds: string[];
    };
    transport: {
      object: 'session.message.transport';
      type: 'mcp' | 'tool_call' | 'metorial_protocol' | 'system';
      mcp: {
        object: 'session.message.transport.mcp';
        id: string | number;
        protocolVersion: string;
        transport: string;
      } | null;
      toolCall: {
        object: 'session.message.transport.tool_call';
        id: string;
      } | null;
    };
    input: Record<string, any> | null;
    output: Record<string, any> | null;
    toolCall: {
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
        inputSchema: {
          type: 'json_schema';
          schema: Record<string, any>;
        } | null;
        outputSchema: {
          type: 'json_schema';
          schema: Record<string, any>;
        } | null;
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
    } | null;
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
    };
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
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSessionsMessagesListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceSessionsMessagesListOutput>(
    [
      7,
      [
        1,
        [
          'session_id',
          'session_provider_id',
          'connection_id',
          'provider_run_id',
          ['hierarchy', 0, [1, ['parent_message_id', 'child_message_ids']]],
          [
            'transport',
            0,
            [1, [['mcp', 0, [1, ['protocol_version']]], 'tool_call']]
          ],
          [
            'tool_call',
            1,
            [
              1,
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
              ]
            ]
          ],
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
        ]
      ]
    ],
    1
  );

export type DashboardInstanceSessionsMessagesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  type?:
    | 'unknown'
    | 'tool_call'
    | 'mcp_control'
    | 'mcp_message'
    | ('unknown' | 'tool_call' | 'mcp_control' | 'mcp_message')[]
    | undefined;
  source?: 'provider' | 'client' | ('provider' | 'client')[] | undefined;
  hierarchy?: 'child' | 'parent' | ('child' | 'parent')[] | undefined;
  status?:
    | 'waiting_for_response'
    | 'succeeded'
    | 'failed'
    | ('waiting_for_response' | 'succeeded' | 'failed')[]
    | undefined;
  id?: string | string[] | undefined;
  sessionId?: string | string[] | undefined;
  sessionProviderId?: string | string[] | undefined;
  sessionConnectionId?: string | string[] | undefined;
  providerRunId?: string | string[] | undefined;
  errorId?: string | string[] | undefined;
  participantId?: string | string[] | undefined;
  parentMessageId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapDashboardInstanceSessionsMessagesListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceSessionsMessagesListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'session_id',
            'session_provider_id',
            'session_connection_id',
            'provider_run_id',
            'error_id',
            'participant_id',
            'parent_message_id',
            ['created_at', 1, 5],
            ['updated_at', 1, 5]
          ]
        ]
      ]
    ]
  ]);
