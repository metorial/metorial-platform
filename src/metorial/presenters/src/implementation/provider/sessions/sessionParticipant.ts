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
        description: "String representing the object’s type."
      }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['spt_5eFgHjKlMnPqRsTu']
      }),
      type: v.enumOf(['unknown', 'provider', 'agent', 'system'] as const, {
        name: 'type',
        description: 'What kind of actor the participant is. Older client types report as `agent`.'
      }),
      identifier: v.string({
        name: 'identifier',
        description: 'How the participant identifies itself.',
        examples: ['claude-desktop']
      }),
      name: v.string({
        name: 'name',
        description: 'Display name.',
        examples: ['Claude Desktop']
      }),
          data: v.object(
        {
          identifier: v.string({
            name: 'identifier',
            description: 'Participant identifier from the connection payload.',
            examples: ['claude-desktop']
          }),
          name: v.string({
            name: 'name',
            description: 'Display name from the connection payload.',
            examples: ['Claude Desktop']
          })
        },
        {
          name: 'data',
          description: 'Extra details the participant connected with.'
        }
      ),
      provider_id: v.nullable(
        v.string({
          name: 'provider_id',
          description: 'Provider the participant belongs to. `null` when there is none.',
          examples: ['pro_5gHjKlMnPqRsTuVw']
        })
      ),
      connection_type: v.nullable(
        v.enumOf(['mcp', 'metorial_protocol', 'tool_call'] as const, {
          description: 'How the participant connected.'
        })
      ),
      agent_id: v.nullable(
        v.string({ description: 'Agent the participant belongs to. `null` when there is none.' })
      ),
      agent_instance_id: v.nullable(
        v.string({
          description: 'Agent instance the participant runs as. `null` when there is none.'
        })
      ),
      identity_actor_id: v.nullable(
        v.string({
          description: 'Identity actor the participant acts as. `null` when there is none.'
        })
      ),
      identity_id: v.nullable(
        v.string({ description: 'Identity the participant acts as. `null` when there is none.' })
      ),
      agent_actor_id: v.nullable(
        v.string({ description: 'Actor record for the agent. `null` when there is none.' })
      ),
      agent_client_id: v.nullable(
        v.string({ description: 'Client record for the agent. `null` when there is none.' })
      ),
      consumer_id: v.nullable(
        v.string({ description: 'Consumer the participant acts for. `null` when there is none.' })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Creation time.',
        examples: [new Date('2025-09-15T10:30:00Z')]
      })
    })
  )
  .build();
