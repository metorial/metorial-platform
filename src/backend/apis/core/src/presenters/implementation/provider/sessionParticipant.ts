import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sessionParticipantType } from '../../types';

export let v1SessionParticipantPresenter = Presenter.create(sessionParticipantType)
  .presenter(async ({ sessionParticipant }) => ({
    object: 'session.participant' as const,

    id: sessionParticipant.id,
    type: sessionParticipant.type,

    identifier: sessionParticipant.identifier,
    name: sessionParticipant.name,
    data: sessionParticipant.data,

    provider_id: sessionParticipant.providerId ?? null,

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
      type: v.enumOf(
        [
          'unknown',
          'provider',
          'mcp_client',
          'metorial_protocol_client',
          'system',
          'tool_call'
        ] as const,
        {
          name: 'type',
          description: 'Participant type'
        }
      ),
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
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      })
    })
  )
  .build();
