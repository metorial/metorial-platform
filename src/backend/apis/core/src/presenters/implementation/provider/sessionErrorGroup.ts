import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { sessionErrorGroupType } from '../../types';

export let v1SessionErrorGroupPresenter = Presenter.create(sessionErrorGroupType)
  .presenter(async ({ sessionErrorGroup }) => ({
    object: 'session.error_group' as const,
    id: sessionErrorGroup.id,
    type: sessionErrorGroup.type,
    name: sessionErrorGroup.name,
    message: sessionErrorGroup.message,
    count: sessionErrorGroup.count,
    metadata: sessionErrorGroup.metadata,
    session_id: sessionErrorGroup.sessionId,
    created_at: sessionErrorGroup.createdAt,
    updated_at: sessionErrorGroup.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('session.error_group', { description: "String representing the object's type" }),
      id: v.string({ name: 'id', description: 'Unique session error group identifier', examples: ['seg_7gHjKlMnPqRsTuVw'] }),
      type: v.nullable(v.string({ name: 'type', description: 'Error type', examples: ['RuntimeError'] })),
      name: v.nullable(v.string({ name: 'name', description: 'Error name', examples: ['ConnectionTimeout'] })),
      message: v.nullable(v.string({ name: 'message', description: 'Error message', examples: ['Connection timed out'] })),
      count: v.number({ name: 'count', description: 'Number of errors in this group', examples: [5] }),
      metadata: v.nullable(v.record(v.any(), { name: 'metadata', description: 'Custom key-value pairs', examples: [{ first_seen: '2025-09-15' }] })),
      session_id: v.string({ name: 'session_id', description: 'Parent session ID', examples: ['ses_4dEfGhJkLmNpQrSt'] }),
      created_at: v.date({ name: 'created_at', description: 'Timestamp when created', examples: [new Date('2025-09-15T10:30:00Z')] }),
      updated_at: v.date({ name: 'updated_at', description: 'Timestamp when last updated', examples: [new Date('2026-01-10T14:45:00Z')] })
    })
  )
  .build();
