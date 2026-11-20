import type {
  Catalog,
  CatalogName,
  CatalogOffering,
  CatalogVendor,
  ModelCapabilities,
  OfferingVariant,
  Pricing
} from '@mtsrc/ai-gateway-spec';
import { metorialProviderSlug } from '@mtsrc/ai-gateway-spec';
import { createHash } from 'node:crypto';
import { stableStringify } from './stable';

type CatalogEntryStatus = 'active' | 'retired';
type ModelStatus = 'preview' | 'active' | 'deprecated' | 'retired';
type ProviderKind =
  'metorial' | 'first_party' | 'cloud' | 'inference' | 'aggregator' | 'subscription';

export type LabRow = {
  slug: string;
  name: string;
  description: string | null;
  website: string | null;
  logo: string | null;
  status: CatalogEntryStatus;
};

export type ProviderRow = {
  slug: string;
  name: string;
  kind: ProviderKind;
  website: string | null;
  docs: string | null;
  logo: string | null;
  status: CatalogEntryStatus;
};

export type ModelRow = {
  slug: string;
  labSlug: string;
  familySlug: string | null;
  name: string;
  description: string | null;
  kind: string;
  status: ModelStatus;
  releaseDate: Date | null;
  openWeights: boolean;
  contextTokens: number | null;
  outputTokens: number | null;
  inputModalities: string[];
  outputModalities: string[];
  capabilities: ModelCapabilities;
};

export type OfferingRow = {
  catalogId: string;
  providerSlug: string;
  modelSlug: string | null;
  vendorModelId: string;
  name: string;
  status: ModelStatus;
  apis: string[];
  pricing: Pricing | null;
  pricingHash: string | null;
  contextTokens: number | null;
  outputTokens: number | null;
  inputModalities: string[];
  outputModalities: string[];
  capabilities: ModelCapabilities;
  variant: OfferingVariant;
};

export type AliasRow = {
  catalogId: string;
  modelSlug: string;
  namespace: string;
  raw: string;
  key: string;
};

export type CatalogProjection = {
  labs: LabRow[];
  providers: ProviderRow[];
  models: ModelRow[];
  offerings: OfferingRow[];
  aliases: AliasRow[];
};

let metorialProvider: ProviderRow = {
  slug: metorialProviderSlug,
  name: 'Metorial',
  kind: 'metorial',
  website: 'https://metorial.com',
  docs: null,
  logo: null,
  status: 'active'
};

let providerKinds: Record<CatalogVendor['kind'], ProviderKind> = {
  'first-party': 'first_party',
  cloud: 'cloud',
  inference: 'inference',
  aggregator: 'aggregator',
  subscription: 'subscription'
};

// Names callers are likely to send as-is: our own, SDK and catalog names, the supported providers'
// ids and those of the gateways people migrate from. Display names ("Claude Sonnet 4") are for
// people and collide too easily; the long tail of resellers mostly adds noise.
let aliasGatewayVendors = ['openrouter', 'vercel-ai-gateway'];

let isAliasNamespace = (namespace: string, supported: Set<string>) => {
  if (namespace == 'metorial') return true;
  if (namespace.startsWith('sdk:') || namespace.startsWith('catalog:')) return true;
  if (!namespace.startsWith('vendor:')) return false;

  let vendor = namespace.slice('vendor:'.length);

  return supported.has(vendor) || aliasGatewayVendors.includes(vendor);
};

export let pricingHash = (pricing: Pricing | null) =>
  pricing ? createHash('sha256').update(stableStringify(pricing)).digest('hex') : null;

export let projectCatalog = (d: {
  catalog: Catalog;
  supportedProviderSlugs: string[];
}): CatalogProjection => {
  let { catalog } = d;
  let supported = new Set(d.supportedProviderSlugs);

  let pointerTargets = new Map<string, string>();
  for (let pointer of catalog.pointers) {
    if (pointer.target.kind == 'model' || pointer.target.kind == 'release') {
      pointerTargets.set(pointer.id, pointer.target.modelId);
    }
  }

  let organizationIds = new Set(catalog.organizations.map(organization => organization.id));

  let models = catalog.models
    .filter(model => organizationIds.has(model.labId))
    .map((model): ModelRow => ({
      slug: model.id,
      labSlug: model.labId,
      familySlug: model.familyId,
      name: model.name,
      description: model.description,
      kind: model.kind,
      status: model.status,
      releaseDate: model.releaseDate ? new Date(`${model.releaseDate}T00:00:00.000Z`) : null,
      openWeights: model.openWeights,
      contextTokens: model.limits.contextTokens ?? model.limits.inputTokens,
      outputTokens: model.limits.outputTokens,
      inputModalities: model.modalities.input,
      outputModalities: model.modalities.output,
      capabilities: model.capabilities
    }));

  let modelSlugs = new Set(models.map(model => model.slug));
  let labSlugs = new Set(models.map(model => model.labSlug));

  let resolveModel = (target: CatalogName['target']) => {
    let modelId =
      target.kind == 'model' || target.kind == 'release'
        ? target.modelId
        : target.kind == 'pointer'
          ? pointerTargets.get(target.pointerId)
          : undefined;

    return modelId && modelSlugs.has(modelId) ? modelId : null;
  };

  let labs = catalog.organizations
    .filter(organization => labSlugs.has(organization.id))
    .map((organization): LabRow => ({
      slug: organization.id,
      name: organization.name,
      description: organization.description,
      website: organization.website,
      logo: organization.logo,
      status: organization.status
    }));

  let providers = [
    metorialProvider,
    ...catalog.vendors
      .filter(vendor => supported.has(vendor.id) && vendor.id != metorialProviderSlug)
      .map((vendor): ProviderRow => ({
        slug: vendor.id,
        name: vendor.name,
        kind: providerKinds[vendor.kind],
        website: vendor.website,
        docs: vendor.docs,
        logo: vendor.logo,
        status: vendor.status
      }))
  ];

  let offeringModel = (offering: CatalogOffering) => {
    if (offering.modelId && modelSlugs.has(offering.modelId)) return offering.modelId;
    if (offering.pointerId) return pointerTargets.get(offering.pointerId) ?? null;

    return null;
  };

  let offerings = catalog.offerings
    .filter(offering => supported.has(offering.vendorId) && offering.kind != 'router')
    .map((offering): OfferingRow => ({
      catalogId: offering.id,
      providerSlug: offering.vendorId,
      modelSlug: offeringModel(offering),
      vendorModelId: offering.vendorModelId,
      name: offering.name,
      status: offering.status,
      apis: offering.apis,
      pricing: offering.pricing,
      pricingHash: pricingHash(offering.pricing),
      contextTokens: offering.limits.contextTokens ?? offering.limits.inputTokens,
      outputTokens: offering.limits.outputTokens,
      inputModalities: offering.modalities.input,
      outputModalities: offering.modalities.output,
      capabilities: offering.capabilities,
      variant: offering.variant
    }));

  let aliases: AliasRow[] = [];
  for (let name of catalog.names) {
    if (name.status != 'live' || !isAliasNamespace(name.namespace, supported)) continue;

    let modelSlug = resolveModel(name.target);
    if (!modelSlug) continue;

    aliases.push({
      catalogId: name.id,
      modelSlug,
      namespace: name.namespace,
      raw: name.raw,
      key: name.key
    });
  }

  return { labs, providers, models, offerings, aliases };
};
