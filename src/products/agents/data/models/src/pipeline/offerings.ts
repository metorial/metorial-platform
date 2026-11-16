import type { ModelsDevProviderModel, ModelsDevSnapshot } from '../sources/modelsDev';
import type {
  Capabilities,
  LifecycleStatus,
  Limits,
  Modalities,
  Offering,
  OfferingKind,
  Pricing,
  SourceKind
} from '../types';
import type { CanonicalCatalog } from './canonicalize';
import {
  cleanModelName,
  toApis,
  toCapabilities,
  toLifecycleStatus,
  toLimits,
  toModalities,
  toPricing
} from './convert';
import { targetModelId, type Resolver, type ResolveResult } from './resolver';
import type { VendorIndex } from './vendors';

let learnableMethods = new Set(['base-model', 'first-party', 'override']);

export interface OfferingDraft {
  vendorId: string;
  endpointId: string;
  endpointSlug: string;
  vendorModelId: string;
  baseModel: string | null;
  name: string;
  status: LifecycleStatus;
  pricing: Pricing | null;
  limits: Limits;
  capabilities: Capabilities;
  modalities: Modalities;
  apis: string[];
  source: SourceKind;
}

export let offeringId = (vendorId: string, endpointSlug: string, vendorModelId: string) =>
  endpointSlug === 'default'
    ? `${vendorId}:${vendorModelId}`
    : `${vendorId}/${endpointSlug}:${vendorModelId}`;

export let draftFromModelsDev = (
  model: ModelsDevProviderModel,
  vendors: VendorIndex
): OfferingDraft | null => {
  let endpoint = vendors.byProvider.get(model.providerId);
  if (!endpoint) return null;

  return {
    vendorId: endpoint.vendorId,
    endpointId: endpoint.endpointId,
    endpointSlug: endpoint.slug,
    vendorModelId: model.id,
    baseModel: model.baseModel,
    name: cleanModelName(model.data.name, model.id),
    status: toLifecycleStatus(model.data.status),
    pricing: toPricing(model.data),
    limits: toLimits(model.data),
    capabilities: toCapabilities(model.data),
    modalities: toModalities(model.data),
    apis: toApis(model.data),
    source: 'models.dev'
  };
};

export let offeringFromDraft = (
  draft: OfferingDraft,
  resolution: ResolveResult,
  catalog: CanonicalCatalog,
  now: string
): Offering => {
  let target = resolution.target;
  let kind: OfferingKind =
    target.kind === 'router' ? 'router' : target.kind === 'pointer' ? 'pointer' : 'model';

  return {
    id: offeringId(draft.vendorId, draft.endpointSlug, draft.vendorModelId),
    vendorId: draft.vendorId,
    endpointIds: [draft.endpointId],
    vendorModelId: draft.vendorModelId,
    name: draft.name,
    kind,
    modelId: targetModelId(target, catalog),
    releaseId: target.kind === 'release' ? target.releaseId : null,
    pointerId: target.kind === 'pointer' ? target.pointerId : null,
    variant: resolution.variant,
    status: draft.status,
    pricing: draft.pricing,
    limits: draft.limits,
    capabilities: draft.capabilities,
    modalities: draft.modalities,
    apis: draft.apis,
    resolution: {
      method: resolution.method,
      upstreamCanonicalId: resolution.upstreamCanonicalId,
      overrideId: resolution.overrideId
    },
    sources: [draft.source],
    firstSeenAt: now,
    lastSeenAt: now
  };
};

// Two passes: links that models.dev states explicitly teach the resolver which vendor names map
// to which models, then names without a link get a second chance through those learned aliases.
export let resolveDrafts = (drafts: OfferingDraft[], resolver: Resolver) => {
  let first = drafts.map(draft => ({
    draft,
    resolution: resolver.resolve({
      vendorId: draft.vendorId,
      vendorModelId: draft.vendorModelId,
      baseModel: draft.baseModel
    })
  }));

  for (let { draft, resolution } of first)
    if (learnableMethods.has(resolution.method))
      resolver.learn(draft.vendorModelId, resolution.target);

  return first.map(entry =>
    entry.resolution.method === 'unresolved'
      ? {
          draft: entry.draft,
          resolution: resolver.resolve({
            vendorId: entry.draft.vendorId,
            vendorModelId: entry.draft.vendorModelId,
            baseModel: entry.draft.baseModel
          })
        }
      : entry
  );
};

export let buildModelsDevOfferings = (
  snapshot: ModelsDevSnapshot,
  vendors: VendorIndex,
  catalog: CanonicalCatalog,
  resolver: Resolver,
  now: string
) => {
  let drafts = snapshot.providerModels
    .map(model => draftFromModelsDev(model, vendors))
    .filter((draft): draft is OfferingDraft => !!draft);

  let offerings = new Map<string, Offering>();
  for (let { draft, resolution } of resolveDrafts(drafts, resolver)) {
    let offering = offeringFromDraft(draft, resolution, catalog, now);
    if (!offerings.has(offering.id)) offerings.set(offering.id, offering);
  }

  return offerings;
};
