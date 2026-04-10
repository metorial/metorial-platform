import { v } from '@lowerdeck/validation';
import { ProviderTemplate } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { providerTemplateType } from '../types';
import { toolFilterPresenter } from './_lib/toolFilter';

export let v1ProviderTemplatePreview = Object.assign(
  (providerTemplate: ProviderTemplate) => ({
    object: 'provider.template#preview' as const,
    id: providerTemplate.id,
    status: providerTemplate.status,
    name: providerTemplate.name,
    description: providerTemplate.description,
    metadata: providerTemplate.metadata,
    provider_deployment_id: providerTemplate.providerDeploymentId,
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
      provider_deployment_id: v.string(),
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
    provider_deployment_id: providerTemplate.providerDeploymentId,
    tool_filters: toolFilterPresenter(providerTemplate.providerDeployment.toolFilter),
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
      provider_deployment_id: v.string(),
      tool_filters: toolFilterPresenter.schema,
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
