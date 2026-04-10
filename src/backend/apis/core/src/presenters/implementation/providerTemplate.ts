import { v } from '@lowerdeck/validation';
import { ProviderTemplate } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { providerTemplateType } from '../types';

export let v1ProviderTemplatePreview = Object.assign(
  (providerTemplate: ProviderTemplate) => ({
    object: 'provider.template#preview' as const,
    id: providerTemplate.id,
    status: providerTemplate.status,
    name: providerTemplate.name,
    description: providerTemplate.description,
    metadata: providerTemplate.metadata,
    provider_deployment_id: providerTemplate.providerDeploymentId
  }),
  {
    schema: v.object({
      object: v.literal('provider.template#preview'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      name: v.string(),
      description: v.nullable(v.string()),
      metadata: v.record(v.any()),
      provider_deployment_id: v.string()
    })
  }
);

export let v1ProviderTemplatePresenter = Presenter.create(providerTemplateType)
  .presenter(async ({ providerTemplate }) => v1ProviderTemplatePreview(providerTemplate))
  .schema(v1ProviderTemplatePreview.schema)
  .build();
