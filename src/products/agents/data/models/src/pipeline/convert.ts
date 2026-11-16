import { uniq } from '../lib/util';
import type { UpstreamModel } from '../sources/modelsDev';
import type {
  Capabilities,
  ContextTier,
  LifecycleStatus,
  Limits,
  Link,
  Modalities,
  Modality,
  ModelKind,
  Pricing,
  TokenRates,
  UnitPrice
} from '../types';

let modelKinds = new Set<ModelKind>([
  'chat',
  'embedding',
  'reranking',
  'image',
  'video',
  'speech',
  'transcription',
  'realtime',
  'audio',
  'decision'
]);

let modalityOrder: Modality[] = ['text', 'image', 'audio', 'video', 'pdf', 'file'];

export let toModelKind = (type: string | undefined): ModelKind => {
  if (!type) return 'chat';
  return modelKinds.has(type as ModelKind) ? (type as ModelKind) : 'other';
};

export let toLifecycleStatus = (status: string | undefined): LifecycleStatus => {
  if (status === 'deprecated') return 'deprecated';
  if (status === 'alpha' || status === 'beta') return 'preview';
  return 'active';
};

export let toIsoDate = (value: string | undefined | null) => {
  if (!value) return null;

  let match = value.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!match) return null;
  return match[3] ? `${match[1]}-${match[2]}-${match[3]}` : `${match[1]}-${match[2]}-01`;
};

export let toModality = (value: string): Modality => {
  let lower = value.toLowerCase();
  if (lower === 'text' || lower.startsWith('text/')) return 'text';
  if (lower === 'pdf' || lower === 'application/pdf') return 'pdf';
  if (lower === 'image' || lower.startsWith('image/')) return 'image';
  if (lower === 'audio' || lower.startsWith('audio/')) return 'audio';
  if (lower === 'video' || lower.startsWith('video/')) return 'video';
  return 'file';
};

let sortModalities = (values: Modality[]) =>
  uniq(values).sort((a, b) => modalityOrder.indexOf(a) - modalityOrder.indexOf(b));

export let toModalities = (data: UpstreamModel): Modalities => ({
  input: sortModalities((data.modalities?.input ?? ['text']).map(toModality)),
  output: sortModalities((data.modalities?.output ?? ['text']).map(toModality))
});

export let toLimits = (data: UpstreamModel): Limits => ({
  contextTokens: data.limit?.context ?? null,
  inputTokens: data.limit?.input ?? null,
  outputTokens: data.limit?.output ?? null
});

export let toCapabilities = (data: UpstreamModel): Capabilities => {
  let caps = data.capabilities ?? {};
  let reasoning = caps.reasoning?.supported
    ? { toggle: caps.reasoning.toggle ?? false, effort: caps.reasoning.effort ?? null }
    : null;

  let cache = caps.cache;
  let promptCaching =
    cache === undefined || cache === false
      ? null
      : cache === true
        ? { implicit: true, explicit: false, ttls: [] }
        : {
            implicit: !!cache.implicit,
            explicit: !!cache.explicit,
            ttls: typeof cache.explicit === 'object' ? (cache.explicit.ttl ?? []) : []
          };

  let input = toModalities(data).input;

  return {
    tools: caps.tools?.supported ?? false,
    toolChoice: caps.tools?.choice ?? null,
    structuredOutput: caps.structured_output ?? false,
    reasoning,
    temperature: caps.temperature ?? true,
    promptCaching,
    attachments: input.some(modality => modality !== 'text')
  };
};

export let toLinks = (data: UpstreamModel): Link[] => [
  ...(data.links ?? []).map(link => ({ label: link.type ?? 'link', url: link.url })),
  ...(data.weights ?? []).map(weight => ({
    label: weight.label ?? 'weights',
    url: weight.url
  }))
];

export let toApis = (data: UpstreamModel) => Object.keys(data.api ?? {}).sort();

type RateCost = NonNullable<NonNullable<NonNullable<UpstreamModel['cost']>['text']>['input']>;

let cacheWrites = (value: number | Record<string, number> | undefined) => {
  if (value === undefined) return [];
  if (typeof value === 'number') return [{ ttl: null, price: value }];
  return Object.entries(value).map(([ttl, price]) => ({ ttl, price }));
};

let isTokenRate = (rate: RateCost | undefined) =>
  !!rate && (!rate.unit || rate.unit === 'token');

let toTokenRates = (
  input: RateCost | undefined,
  output: RateCost | undefined
): TokenRates | null => {
  let tokenInput = isTokenRate(input) ? input : undefined;
  let tokenOutput = isTokenRate(output) ? output : undefined;
  if (!tokenInput && !tokenOutput) return null;

  let cache = tokenInput?.cache;

  return {
    input: tokenInput?.price ?? null,
    output: tokenOutput?.price ?? null,
    cacheRead: cache?.read ?? cache?.explicit?.read ?? null,
    cacheWrite: cacheWrites(cache?.write ?? cache?.explicit?.write),
    reasoning: tokenOutput?.reasoning ?? null
  };
};

let contextThreshold = (when: Record<string, any> | undefined) => {
  let context = when?.context;
  if (!context || typeof context !== 'object') return null;
  if (typeof context.gt === 'number') return context.gt + 1;
  if (typeof context.gte === 'number') return context.gte;
  return null;
};

let toContextTiers = (input: RateCost | undefined, output: RateCost | undefined) => {
  let tiers = new Map<number, ContextTier>();
  let tier = (min: number) => {
    let existing = tiers.get(min);
    if (existing) return existing;

    let created: ContextTier = {
      minInputTokens: min,
      input: null,
      output: null,
      cacheRead: null
    };
    tiers.set(min, created);
    return created;
  };

  for (let override of input?.overrides ?? []) {
    let min = contextThreshold(override.when);
    if (min === null) continue;

    tier(min).input = override.price ?? null;
    tier(min).cacheRead = override.cache?.read ?? null;
  }

  for (let override of output?.overrides ?? []) {
    let min = contextThreshold(override.when);
    if (min !== null) tier(min).output = override.price ?? null;
  }

  return [...tiers.values()].sort((a, b) => a.minInputTokens - b.minInputTokens);
};

export let toPricing = (data: UpstreamModel): Pricing | null => {
  let cost = data.cost;
  if (!cost) return null;

  let units: UnitPrice[] = [];
  for (let modality of ['text', 'image', 'audio', 'video'] as const) {
    for (let direction of ['input', 'output'] as const) {
      let rate = cost[modality]?.[direction];
      if (rate?.unit && rate.unit !== 'token' && rate.price !== undefined)
        units.push({ modality, direction, unit: rate.unit, price: rate.price });
    }
  }

  let pricing: Pricing = {
    currency: 'USD',
    text: toTokenRates(cost.text?.input, cost.text?.output),
    image: toTokenRates(cost.image?.input, cost.image?.output),
    audio: toTokenRates(cost.audio?.input, cost.audio?.output),
    video: toTokenRates(cost.video?.input, cost.video?.output),
    contextTiers: toContextTiers(cost.text?.input, cost.text?.output),
    units,
    webSearchPer1k: cost.web_search?.price ?? null
  };

  let empty =
    !pricing.text &&
    !pricing.image &&
    !pricing.audio &&
    !pricing.video &&
    !units.length &&
    pricing.webSearchPer1k === null;

  return empty ? null : pricing;
};

export let cleanModelName = (name: string | undefined, fallback: string) =>
  (name ?? fallback).replace(/\s*\((latest)\)\s*$/i, '').trim() || fallback;
