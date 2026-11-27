import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { presentOwnerActor, presentResourceSource, resourceAccessSchema } from '../../_shared';
import { sessionTemplateType } from '../../../types';
import { v1SessionTemplateProviderPresenter } from './sessionTemplateProvider';

export let v1SessionTemplatePresenter = Presenter.create(sessionTemplateType)
  .presenter(async ({ sessionTemplate }, opts) => ({
    object: 'session.template' as const,
    id: sessionTemplate.id,

    status: sessionTemplate.status,

    name: sessionTemplate.name,
    description: sessionTemplate.description,
    metadata: sessionTemplate.metadata,

    integration_instance_id: sessionTemplate.integrationInstance?.id ?? null,
    integration_instance_group_id: sessionTemplate.integrationInstanceGroup?.id ?? null,
    identity_actor_id: sessionTemplate.identityActor?.id ?? null,
    access: {
      source: presentResourceSource(sessionTemplate.source),
      type: sessionTemplate.isOwnerLocked ? ('owner_locked' as const) : ('public' as const),
      visibility: sessionTemplate.isOwnerOnlyVisible
        ? ('owner' as const)
        : ('anyone' as const),
      owner: presentOwnerActor(sessionTemplate.ownerActor ?? sessionTemplate.identityActor)
    },
    identity_id: sessionTemplate.identity?.id ?? null,

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
        description: "String representing the object’s type."
      }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['stm_2bCdEfGhJkLmNpQr']
      }),
      status: v.enumOf(['active', 'archived', 'deleted'] as const, {
        name: 'status',
        description: '`archived` once the template is deleted. Archived templates stay listable.'
      }),
      name: v.string({
        name: 'name',
        description: 'Display name.',
        examples: ['Production Template']
      }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Free-text description.',
          examples: ['Template for production sessions']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom data you attach to identify or organize this record.',
          examples: [{ environment: 'production' }]
        })
      ),
      integration_instance_id: v.nullable(
        v.string({
          description: 'Integration instance linked to this template. `null` when there is none.'
        })
      ),
      integration_instance_group_id: v.nullable(
        v.string({
          description:
            'Integration instance group linked to this template. `null` when there is none.'
        })
      ),
      identity_actor_id: v.nullable(
        v.string({
          description: 'Identity actor linked to this template. `null` when there is none.'
        })
      ),
      access: resourceAccessSchema,
      identity_id: v.nullable(
        v.string({
          description: 'Identity linked to this template. `null` when there is none.'
        })
      ),
      providers: v.array(v1SessionTemplateProviderPresenter.schema, {
        name: 'providers',
        description: 'Providers that sessions created from this template connect to.'
      }),
      created_at: v.date({
        name: 'created_at',
        description: 'Creation time.',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Last update time.',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
