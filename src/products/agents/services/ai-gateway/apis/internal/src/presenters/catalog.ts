import type { CatalogSync, Lab, Model, ModelOffering, Provider } from '@mtsrc/ai-gateway-db';
import { getProviderDefinition, isSupportedProvider } from '@mtsrc/ai-gateway-providers';

export let labPresenter = (lab: Lab) => ({
  object: 'ai_gateway#lab',

  id: lab.id,
  slug: lab.slug,
  name: lab.name,
  description: lab.description,
  website: lab.website,
  logo: lab.logo,
  status: lab.status
});

export let providerPresenter = (provider: Provider) => ({
  object: 'ai_gateway#provider',

  id: provider.id,
  slug: provider.slug,
  name: provider.name,
  kind: provider.kind,
  website: provider.website,
  docs: provider.docs,
  logo: provider.logo,
  status: provider.status,

  supported: isSupportedProvider(provider.slug),
  features: isSupportedProvider(provider.slug)
    ? getProviderDefinition(provider.slug).features
    : []
});

export let modelPresenter = (model: Model & { lab: Lab }) => ({
  object: 'ai_gateway#model',

  id: model.id,
  slug: model.slug,
  name: model.name,
  description: model.description,
  kind: model.kind,
  status: model.status,

  lab: { id: model.lab.id, slug: model.lab.slug, name: model.lab.name },
  familySlug: model.familySlug,

  releaseDate: model.releaseDate,
  openWeights: model.openWeights,

  contextTokens: model.contextTokens,
  outputTokens: model.outputTokens,
  modalities: { input: model.inputModalities, output: model.outputModalities },
  capabilities: model.capabilities
});

export let offeringPresenter = (
  offering: ModelOffering & { provider: Provider; model: (Model & { lab: Lab }) | null }
) => ({
  object: 'ai_gateway#model_offering',

  id: offering.id,
  name: `${offering.provider.slug}:${offering.vendorModelId}`,
  vendorModelId: offering.vendorModelId,
  displayName: offering.name,
  status: offering.status,

  provider: { id: offering.provider.id, slug: offering.provider.slug },
  model: offering.model ? { id: offering.model.id, slug: offering.model.slug } : null,

  apis: offering.apis,
  pricing: offering.pricing,

  contextTokens: offering.contextTokens,
  outputTokens: offering.outputTokens,
  modalities: { input: offering.inputModalities, output: offering.outputModalities },
  capabilities: offering.capabilities,
  variant: offering.variant
});

export let catalogSyncPresenter = (sync: CatalogSync | null) => ({
  object: 'ai_gateway#catalog_sync',

  url: sync?.url ?? null,
  fingerprint: sync?.fingerprint ?? null,
  counts: sync?.counts ?? null,
  lastError: sync?.lastError ?? null,

  generatedAt: sync?.generatedAt ?? null,
  lastCheckedAt: sync?.lastCheckedAt ?? null,
  lastSyncedAt: sync?.lastSyncedAt ?? null
});
