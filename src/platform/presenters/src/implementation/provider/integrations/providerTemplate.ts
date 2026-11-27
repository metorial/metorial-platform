import { v } from '@lowerdeck/validation';
import { ProviderTemplate } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { providerTemplateType } from '../../../types';

export let v1ProviderTemplatePreview = Object.assign(
  (providerTemplate: ProviderTemplate & { subspaceIntegrationId?: string | null }) => ({
    object: 'provider.template#preview' as const,
    id: providerTemplate.id,
    status: providerTemplate.status,
    name: providerTemplate.name,
    description: providerTemplate.description,
    metadata: providerTemplate.metadata,
    integration_id: providerTemplate.subspaceIntegrationId ?? null,
    created_at: providerTemplate.createdAt,
    updated_at: providerTemplate.updatedAt
  }),
  {
    schema: v.object({
      object: v.literal('provider.template#preview', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        description: 'Unique ID.',
        examples: ['ptm_4dEfGhJkLmNpQrSt']
      }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        description: '`archived` once you archive the template.'
      }),
      name: v.string({
        description: 'Display name.'
      }),
      description: v.nullable(
        v.string({
          description: 'Free-text description.'
        })
      ),
      metadata: v.record(v.any(), {
        description: 'Custom data you attach to identify or organize this record.'
      }),
      integration_id: v.nullable(
        v.string({
          description:
            'Integration the template was created from. `null` when it wasn’t created from one.',
          examples: ['int_2bCdEfGhJkLmNpQr']
        })
      ),
      created_at: v.date({
        description: 'Creation time.'
      }),
      updated_at: v.date({
        description: 'Last update time.'
      })
    })
  }
);

export let v1ProviderTemplatePresenter = Presenter.create(providerTemplateType)
  .presenter(async ({ providerTemplate }) => ({
    object: 'provider.template' as const,
    id: providerTemplate.id,
    status: providerTemplate.status,
    name: providerTemplate.name,
    description: providerTemplate.description,
    metadata: providerTemplate.metadata,
    integration_id: providerTemplate.subspaceIntegrationId,
    created_at: providerTemplate.createdAt,
    updated_at: providerTemplate.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.template', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        description: 'Unique ID.',
        examples: ['ptm_4dEfGhJkLmNpQrSt']
      }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        description: '`archived` once you archive the template.'
      }),
      name: v.string({
        description: 'Display name.'
      }),
      description: v.nullable(
        v.string({
          description: 'Free-text description.'
        })
      ),
      metadata: v.record(v.any(), {
        description: 'Custom data you attach to identify or organize this record.'
      }),
      integration_id: v.nullable(
        v.string({
          description:
            'Integration the template was created from. `null` when it wasn’t created from one.',
          examples: ['int_2bCdEfGhJkLmNpQr']
        })
      ),
      created_at: v.date({
        description: 'Creation time.'
      }),
      updated_at: v.date({
        description: 'Last update time.'
      })
    })
  )
  .build();
