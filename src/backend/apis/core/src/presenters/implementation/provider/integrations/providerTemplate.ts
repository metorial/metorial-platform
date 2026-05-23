import { v } from '@mtsrc/validation';
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
      object: v.literal('provider.template#preview'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      name: v.string(),
      description: v.nullable(v.string()),
      metadata: v.record(v.any()),
      integration_id: v.nullable(v.string()),
      created_at: v.date(),
      updated_at: v.date()
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
      object: v.literal('provider.template'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      name: v.string(),
      description: v.nullable(v.string()),
      metadata: v.record(v.any()),
      integration_id: v.nullable(v.string()),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
