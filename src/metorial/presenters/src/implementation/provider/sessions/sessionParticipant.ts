import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sessionParticipantType } from '../../../types';

let normalizeParticipantType = (
  type:
    | 'legacy_mcp_client'
    | 'legacy_metorial_protocol_client'
    | 'legacy_tool_call'
    | 'agent'
    | 'provider'
    | 'system'
    | 'unknown'
) => (type.startsWith('legacy_') ? ('agent' as const) : type);

export let v1SessionParticipantPresenter = Presenter.create(sessionParticipantType)
  .presenter(async ({ sessionParticipant }) => ({
    object: 'session.participant' as const,

    id: sessionParticipant.id,
    type: normalizeParticipantType(sessionParticipant.type),

    identifier: sessionParticipant.identifier,
    name: sessionParticipant.name,
    data: sessionParticipant.payload,

    provider_id: sessionParticipant.provider?.id ?? null,
    connection_type: sessionParticipant.connectionType ?? null,
    agent_id: sessionParticipant.agentInstance?.agent.id ?? null,
    agent_instance_id: sessionParticipant.agentInstance?.id ?? null,
    identity_actor_id: sessionParticipant.identityActor?.id ?? null,
    identity_id: sessionParticipant.identity?.id ?? null,
    agent_actor_id: sessionParticipant.agentInstance?.agent.actor?.id ?? null,
    agent_client_id: sessionParticipant.agentInstance?.agentClient?.id ?? null,
    consumer_id: sessionParticipant.consumerId ?? null,

    created_at: sessionParticipant.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('session.participant', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique session participant identifier',
        examples: ['spt_5eFgHjKlMnPqRsTu']
      }),
      type: v.enumOf(['unknown', 'provider', 'agent', 'system'] as const, {
        name: 'type',
        description: 'Participant type'
      }),
      identifier: v.string({
        name: 'identifier',
        description: 'Participant identifier',
        examples: ['claude-desktop']
      }),
      name: v.string({
        name: 'name',
        description: 'Display name',
        examples: ['Claude Desktop']
      }),
      data: v.object(
        {
          identifier: v.string({
            name: 'identifier',
            description: 'Participant-specific identifier within the payload',
            examples: ['claude-desktop']
          }),
          name: v.string({
            name: 'name',
            description: 'Participant-specific display name within the payload',
            examples: ['Claude Desktop']
          })
        },
        {
          name: 'data',
          description: 'Participant payload data'
        }
      ),
      provider_id: v.nullable(
        v.string({
          name: 'provider_id',
          description: 'Provider ID if associated',
          examples: ['pro_5gHjKlMnPqRsTuVw']
        })
      ),
      connection_type: v.nullable(
        v.enumOf(['mcp', 'metorial_protocol', 'tool_call'] as const)
      ),
      agent_id: v.nullable(v.string()),
      agent_instance_id: v.nullable(v.string()),
      identity_actor_id: v.nullable(v.string()),
      identity_id: v.nullable(v.string()),
      agent_actor_id: v.nullable(v.string()),
      agent_client_id: v.nullable(v.string()),
      consumer_id: v.nullable(v.string()),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      })
    })
  )
  .build();
