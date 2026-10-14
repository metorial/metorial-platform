import { createMapper } from '@metorial/util-resource-mapper/compact';

export type SessionsParticipantsListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapSessionsParticipantsListOutput =
  /* @__PURE__ */ createMapper<SessionsParticipantsListOutput>(
    [
      7,
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
    1
  );

export type SessionsParticipantsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  type?:
    | 'unknown'
    | 'provider'
    | 'system'
    | 'tool_call'
    | 'mcp_client'
    | 'metorial_protocol_client'
    | (
        | 'unknown'
        | 'provider'
        | 'system'
        | 'tool_call'
        | 'mcp_client'
        | 'metorial_protocol_client'
      )[]
    | undefined;
  id?: string | string[] | undefined;
  agentId?: string | string[] | undefined;
  actorId?: string | string[] | undefined;
  consumerId?: string | string[] | undefined;
  identityId?: string | string[] | undefined;
  agentInstanceId?: string | string[] | undefined;
  sessionId?: string | string[] | undefined;
  sessionConnectionId?: string | string[] | undefined;
  sessionMessageId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapSessionsParticipantsListQuery =
  /* @__PURE__ */ createMapper<SessionsParticipantsListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'agent_id',
            'actor_id',
            'consumer_id',
            'identity_id',
            'agent_instance_id',
            'session_id',
            'session_connection_id',
            'session_message_id',
            ['created_at', 1, 5],
            ['updated_at', 1, 5]
          ]
        ]
      ]
    ]
  ]);
