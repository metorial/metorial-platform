import { uniq } from '../lib/util';
import { perToken, perUnit } from '../sources/fetch';
import type { GatewayModel } from '../sources/aiGateway';
import type { OpenRouterModel } from '../sources/openrouter';
import type {
  Capabilities,
  Modalities,
  Offering,
  Pricing,
  SourceKind,
  TokenRates
} from '../types';
import type { CanonicalCatalog } from './canonicalize';
import { toModality } from './convert';
import { offeringFromDraft, offeringId, type OfferingDraft } from './offerings';
import type { Resolver } from './resolver';
import type { VendorIndex } from './vendors';

let openRouterProvider = 'openrouter';
let gatewayProvider = 'vercel';

export interface SecondaryMergeStats {
  source: SourceKind;
  matched: number;
  added: number;
  priceChanges: { offeringId: string; before: TokenRates | null; after: TokenRates | null }[];
  delisted: string[];
}

let tokenRates = (rates: Partial<TokenRates>): TokenRates | null => {
  let result: TokenRates = {
    input: rates.input ?? null,
    output: rates.output ?? null,
    cacheRead: rates.cacheRead ?? null,
    cacheWrite: rates.cacheWrite ?? [],
    reasoning: rates.reasoning ?? null
  };
  return result.input === null && result.output === null ? null : result;
};

let modalities = (
  input: string[] | null | undefined,
  output: string[] | null | undefined
): Modalities => ({
  input: uniq((input ?? ['text']).map(toModality)),
  output: uniq((output ?? ['text']).map(toModality))
});

let capabilitiesFrom = (
  params: string[],
  extra: {
    reasoning?: { toggle: boolean; effort: string[] | null } | null;
    caching: boolean;
    attachments: boolean;
  }
): Capabilities => ({
  tools: params.includes('tools'),
  toolChoice: params.includes('tool_choice') ? ['auto', 'none', 'required'] : null,
  structuredOutput:
    params.includes('structured_outputs') || params.includes('response_format'),
  reasoning:
    extra.reasoning ?? (params.includes('reasoning') ? { toggle: true, effort: null } : null),
  temperature: params.includes('temperature'),
  promptCaching: extra.caching ? { implicit: true, explicit: false, ttls: [] } : null,
  attachments: extra.attachments
});

let pricing = (text: TokenRates | null, extra: Partial<Pricing> = {}): Pricing | null => {
  if (!text && !extra.units?.length && extra.webSearchPer1k == null) return null;

  return {
    currency: 'USD',
    text,
    image: null,
    audio: null,
    video: null,
    contextTiers: [],
    units: extra.units ?? [],
    webSearchPer1k: extra.webSearchPer1k ?? null
  };
};

let apiFromEndpoint = (endpoint: string) =>
  endpoint
    .replace(/^\/api\/v1\//, '')
    .replace(/^\/v1\//, '')
    .replace(/\//g, '-');

export let openRouterDraft = (
  model: OpenRouterModel,
  vendors: VendorIndex
): OfferingDraft | null => {
  let endpoint = vendors.byProvider.get(openRouterProvider);
  if (!endpoint) return null;

  let p = model.pricing ?? {};
  let text = tokenRates({
    input: perToken(p.prompt),
    output: perToken(p.completion),
    cacheRead: perToken(p.input_cache_read),
    cacheWrite:
      perToken(p.input_cache_write) === null
        ? []
        : [{ ttl: null, price: perToken(p.input_cache_write)! }],
    reasoning: perToken(p.internal_reasoning)
  });

  let webSearch = perUnit(p.web_search);
  let image = perUnit(p.image);
  let mods = modalities(
    model.architecture?.input_modalities,
    model.architecture?.output_modalities
  );
  let params = model.supported_parameters ?? [];

  return {
    vendorId: endpoint.vendorId,
    endpointId: endpoint.endpointId,
    endpointSlug: endpoint.slug,
    vendorModelId: model.id,
    baseModel: null,
    name: model.name ?? model.id,
    status: model.expiration_date ? 'deprecated' : 'active',
    pricing: pricing(text, {
      webSearchPer1k: webSearch === null ? null : Math.round(webSearch * 1000 * 1e6) / 1e6,
      units: image
        ? [{ modality: 'image', direction: 'input', unit: 'image', price: image }]
        : []
    }),
    limits: {
      contextTokens: model.context_length ?? null,
      inputTokens: null,
      outputTokens: model.top_provider?.max_completion_tokens ?? null
    },
    capabilities: capabilitiesFrom(params, {
      reasoning: model.reasoning
        ? {
            toggle: !model.reasoning.mandatory,
            effort: model.reasoning.supported_efforts ?? null
          }
        : null,
      caching: perToken(p.input_cache_read) !== null,
      attachments: mods.input.some(modality => modality !== 'text')
    }),
    modalities: mods,
    apis: (model.endpoints ?? []).map(apiFromEndpoint).sort(),
    source: 'openrouter'
  };
};

export let gatewayDraft = (
  model: GatewayModel,
  vendors: VendorIndex
): OfferingDraft | null => {
  let endpoint = vendors.byProvider.get(gatewayProvider);
  if (!endpoint) return null;

  let p = model.pricing ?? {};
  let text = tokenRates({
    input: perToken(p.input),
    output: perToken(p.output),
    cacheRead: perToken(p.input_cache_read),
    cacheWrite:
      perToken(p.input_cache_write) === null
        ? []
        : [{ ttl: null, price: perToken(p.input_cache_write)! }]
  });

  let tags = model.tags ?? [];
  let params = [
    ...(model.supported_parameters ?? []),
    ...(tags.includes('tool-use') ? ['tools'] : [])
  ];
  let mods = modalities(model.modalities?.input, model.modalities?.output);

  return {
    vendorId: endpoint.vendorId,
    endpointId: endpoint.endpointId,
    endpointSlug: endpoint.slug,
    vendorModelId: model.id,
    baseModel: null,
    name: model.name ?? model.id,
    status: 'active',
    pricing: pricing(text),
    limits: {
      contextTokens: model.context_window ?? null,
      inputTokens: null,
      outputTokens: model.max_tokens ?? null
    },
    capabilities: capabilitiesFrom(params, {
      reasoning: tags.includes('reasoning') ? { toggle: true, effort: null } : null,
      caching: perToken(p.input_cache_read) !== null || tags.includes('implicit-caching'),
      attachments: mods.input.some(modality => modality !== 'text')
    }),
    modalities: mods,
    apis: [],
    source: 'ai-gateway'
  };
};

// OpenRouter's model list only contains chat models; embeddings, image, video and speech models
// it sells are listed elsewhere, so their absence there says nothing.
export let chatListingCovers = (catalog: CanonicalCatalog) => (offering: Offering) => {
  let model = offering.modelId ? catalog.models.get(offering.modelId) : null;
  if (model) return model.kind === 'chat';
  return offering.modalities.output.includes('text');
};

let sameRates = (a: TokenRates | null, b: TokenRates | null) =>
  (a?.input ?? null) === (b?.input ?? null) && (a?.output ?? null) === (b?.output ?? null);

// The vendor's own live listing is authoritative for its prices and for what it still sells;
// models.dev stays the source for everything it knows that the listing doesn't say.
export let mergeVendorListing = (opts: {
  source: SourceKind;
  drafts: OfferingDraft[];
  aliases?: Map<string, string>;
  covers?: (offering: Offering) => boolean;
  offerings: Map<string, Offering>;
  catalog: CanonicalCatalog;
  resolver: Resolver;
  now: string;
}): SecondaryMergeStats => {
  let stats: SecondaryMergeStats = {
    source: opts.source,
    matched: 0,
    added: 0,
    priceChanges: [],
    delisted: []
  };
  let listed = new Set<string>();
  let vendorId = opts.drafts[0]?.vendorId;

  for (let draft of opts.drafts) {
    let id = offeringId(draft.vendorId, draft.endpointSlug, draft.vendorModelId);
    let existing = opts.offerings.get(id);
    listed.add(id);

    if (existing) {
      stats.matched++;
      if (draft.pricing && !sameRates(existing.pricing?.text ?? null, draft.pricing.text)) {
        stats.priceChanges.push({
          offeringId: id,
          before: existing.pricing?.text ?? null,
          after: draft.pricing.text
        });
        existing.pricing = existing.pricing
          ? {
              ...existing.pricing,
              text: draft.pricing.text,
              webSearchPer1k: draft.pricing.webSearchPer1k ?? existing.pricing.webSearchPer1k
            }
          : draft.pricing;
      }

      existing.limits = {
        contextTokens: draft.limits.contextTokens ?? existing.limits.contextTokens,
        inputTokens: existing.limits.inputTokens,
        outputTokens: draft.limits.outputTokens ?? existing.limits.outputTokens
      };
      if (draft.status === 'deprecated') existing.status = 'deprecated';
      existing.sources = uniq([...existing.sources, opts.source]).sort() as SourceKind[];
      continue;
    }

    let resolution = opts.resolver.resolve({
      vendorId: draft.vendorId,
      vendorModelId: draft.vendorModelId
    });
    let alias = opts.aliases?.get(draft.vendorModelId);

    if (resolution.method === 'unresolved' && alias) {
      let viaAlias = opts.resolver.resolve({ vendorId: draft.vendorId, vendorModelId: alias });
      if (viaAlias.method !== 'unresolved')
        resolution = { ...viaAlias, variant: resolution.variant, parsed: resolution.parsed };
    }

    opts.offerings.set(id, offeringFromDraft(draft, resolution, opts.catalog, opts.now));
    stats.added++;
  }

  if (vendorId && opts.drafts.length) {
    for (let offering of opts.offerings.values()) {
      if (
        offering.vendorId !== vendorId ||
        listed.has(offering.id) ||
        offering.status === 'retired'
      )
        continue;
      if (opts.covers && !opts.covers(offering)) continue;
      offering.status = 'retired';
      stats.delisted.push(offering.id);
    }
  }

  return stats;
};
