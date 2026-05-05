import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sessionTemplateType } from '../../types';
import { v1SessionTemplateProviderPresenter } from './sessionTemplateProvider';

export let v1SessionTemplatePresenter = Presenter.create(sessionTemplateType)
  .presenter(async ({ sessionTemplate }, opts) => ({
    object: 'session.template' as const,
    id: sessionTemplate.id,

    status: sessionTemplate.status,

    name: sessionTemplate.name,
    description: sessionTemplate.description,
    metadata: sessionTemplate.metadata,

    integration_instance_id: sessionTemplate.integrationInstanceId,
    integration_instance_group_id: sessionTemplate.integrationInstanceGroupId,

    providers: await Promise.all(
      sessionTemplate.providers
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(p =>
          v1SessionTemplateProviderPresenter
            .present({ sessionTemplateProvider: p }, opts)
            .run()
        )
    ),

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
      status: v.enumOf(['active', 'archived', 'deleted'] as const, {
        name: 'status',
        description: 'Status of the session template'
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
      integration_instance_id: v.nullable(v.string()),
      integration_instance_group_id: v.nullable(v.string()),
      providers: v.array(v1SessionTemplateProviderPresenter.schema, {
        name: 'providers',
        description: 'Template providers'
      }),
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
