import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { sessionParticipantType } from '../../types';

export let v1SessionParticipantPresenter = Presenter.create(sessionParticipantType)
  .presenter(async ({ sessionParticipant }) => ({
    object: 'session.participant' as const,
    id: sessionParticipant.id,
    type: sessionParticipant.type,
    name: sessionParticipant.name,
    description: sessionParticipant.description,
    metadata: sessionParticipant.metadata,
    session_id: sessionParticipant.sessionId,
    created_at: sessionParticipant.createdAt,
    updated_at: sessionParticipant.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('session.participant', { description: "String representing the object's type" }),
      id: v.string({ name: 'id', description: 'Unique session participant identifier', examples: ['spt_5eFgHjKlMnPqRsTu'] }),
      type: v.nullable(v.string({ name: 'type', description: 'Participant type', examples: ['client'] })),
      name: v.nullable(v.string({ name: 'name', description: 'Display name', examples: ['Claude Desktop'] })),
      description: v.nullable(v.string({ name: 'description', description: 'Description', examples: ['Claude desktop client connection'] })),
      metadata: v.nullable(v.record(v.any(), { name: 'metadata', description: 'Custom key-value pairs', examples: [{ client_version: '1.2.3' }] })),
      session_id: v.string({ name: 'session_id', description: 'Parent session ID', examples: ['ses_4dEfGhJkLmNpQrSt'] }),
      created_at: v.date({ name: 'created_at', description: 'Timestamp when created', examples: [new Date('2025-09-15T10:30:00Z')] }),
      updated_at: v.date({ name: 'updated_at', description: 'Timestamp when last updated', examples: [new Date('2026-01-10T14:45:00Z')] })
    })
  )
  .build();
