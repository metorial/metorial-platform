import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sessionErrorGroupType } from '../../../types';

export let v1SessionErrorGroupPresenter = Presenter.create(sessionErrorGroupType)
  .presenter(async ({ sessionErrorGroup }) => ({
    object: 'session.error_group' as const,

    id: sessionErrorGroup.id,

    code: sessionErrorGroup.code,
    message: sessionErrorGroup.message,
    data: sessionErrorGroup.firstOccurrence?.payload || {},

    provider_id: sessionErrorGroup.provider?.id ?? null,

    occurrence_count: sessionErrorGroup.occurrenceCount,

    created_at: sessionErrorGroup.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('session.error_group', {
        description: "String representing the object’s type."
      }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['seg_7gHjKlMnPqRsTuVw']
      }),
      code: v.string({
        name: 'code',
        description: 'Machine-readable error code.',
        examples: ['CONNECTION_TIMEOUT']
      }),
      message: v.string({
        name: 'message',
        description: 'Human-readable summary of the failure.',
        examples: ['Connection timed out']
      }),
      data: v.record(v.any(), {
        name: 'data',
        description: 'Error group data from the first occurrence.',
        examples: [{ timeout_ms: 30000 }]
      }),
      provider_id: v.nullable(
        v.string({
          name: 'provider_id',
          description: 'Provider the errors belong to. `null` when there is none.',
          examples: ['pro_5gHjKlMnPqRsTuVw']
        })
      ),
      occurrence_count: v.number({
        name: 'occurrence_count',
        description: 'How many errors are in this group.',
        examples: [5]
      }),
      created_at: v.date({
        name: 'created_at',
        description: 'Creation time.',
        examples: [new Date('2025-09-15T10:30:00Z')]
      })
    })
  )
  .build();
