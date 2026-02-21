import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { providerSessionTemplateType } from '../../types';

export let v1SessionTemplatePresenter = Presenter.create(providerSessionTemplateType)
  .presenter(async ({ sessionTemplate }) => ({
    object: 'session.template' as const,
    id: sessionTemplate.id,
    name: sessionTemplate.name,
    description: sessionTemplate.description,
    metadata: sessionTemplate.metadata,
    created_at: sessionTemplate.createdAt,
    updated_at: sessionTemplate.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('session.template', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique session template identifier',
        examples: ['stm_2bCdEfGhJkLmNpQr']
      }),
      name: v.string({
        name: 'name',
        description: 'Template name',
        examples: ['Production Template']
      }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Template description',
          examples: ['Template for production sessions']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom key-value pairs',
          examples: [{ environment: 'production' }]
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
