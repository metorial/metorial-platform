import { applyConnectionPricing } from '@mtsrc/ai-gateway-cost';
import {
  hasFeatures,
  type ConnectionPricingOverride,
  type Pricing,
  type PricingSource,
  type ProviderFeature,
  type ProviderFeatures
} from '@mtsrc/ai-gateway-spec';

export type ConnectionStatus = 'pending' | 'valid' | 'invalid' | 'disabled';

export type OfferingOption = {
  id: string;
  providerSlug: string;
  vendorModelId: string;
  pricing: Pricing | null;
};

export type CustomerConnectionOption = {
  id: string;
  providerSlug: string;
  priority: number;
  status: ConnectionStatus;
  features: ProviderFeatures;
  pricingOverride: ConnectionPricingOverride | null;
  createdAt: Date;
};

export type RoutingRuleOption = {
  slug: string;
  priority: number;
  weight: number;
  labSlug: string | null;
  modelSlug: string | null;
  pricingOverride: Pricing | null;
  connection: {
    slug: string;
    providerSlug: string;
    status: ConnectionStatus;
    features: ProviderFeatures;
  };
};

export type RouteCandidate = {
  billedProviderSlug: string;
  providerSlug: string;
  offeringId: string;
  vendorModelId: string;
  billedPricing: Pricing | null;
  billedPricingSource: PricingSource;
  providerPricing: Pricing | null;
} & (
  | { connectionOwner: 'customer'; connectionId: string }
  | { connectionOwner: 'platform'; platformConnectionSlug: string; routingRuleSlug: string }
);

export type RouteTarget =
  | { kind: 'any' }
  | { kind: 'provider'; providerSlug: string; vendorModelId?: string }
  | { kind: 'metorial' };

let statusRank: Record<ConnectionStatus, number> = {
  valid: 0,
  pending: 1,
  invalid: 2,
  disabled: 3
};

let isUsable = (status: ConnectionStatus) => status == 'valid' || status == 'pending';

// A provider can list a model under several ids (dated snapshot, `-latest` pointer, regional
// variant). The exact pinned id wins; otherwise the shortest, then alphabetical, keeps it stable.
let pickOffering = (offerings: OfferingOption[], vendorModelId?: string) => {
  if (vendorModelId) {
    let exact = offerings.find(offering => offering.vendorModelId == vendorModelId);
    if (exact) return exact;
  }

  return [...offerings].sort(
    (a, b) =>
      a.vendorModelId.length - b.vendorModelId.length ||
      a.vendorModelId.localeCompare(b.vendorModelId)
  )[0];
};

let groupByProvider = (offerings: OfferingOption[]) => {
  let groups = new Map<string, OfferingOption[]>();
  for (let offering of offerings) {
    groups.set(offering.providerSlug, [
      ...(groups.get(offering.providerSlug) ?? []),
      offering
    ]);
  }

  return groups;
};

// Weighted shuffle (Efraimidis–Spirakis): sorting by u^(1/w) draws rules in proportion to their
// weight while still producing a full fallback order.
export let weightedOrder = <T extends { weight: number }>(items: T[], random: () => number) =>
  items
    .map(item => ({ item, key: random() ** (1 / Math.max(1, item.weight)) }))
    .sort((a, b) => b.key - a.key)
    .map(entry => entry.item);

let customerCandidates = (d: {
  model: { slug: string; labSlug: string };
  target: RouteTarget;
  requiredFeatures: ProviderFeature[];
  connections: CustomerConnectionOption[];
  offerings: Map<string, OfferingOption[]>;
}): RouteCandidate[] => {
  let connections = d.connections.filter(connection => {
    if (
      !isUsable(connection.status) ||
      !d.offerings.has(connection.providerSlug) ||
      !hasFeatures(connection.features, d.requiredFeatures)
    ) {
      return false;
    }

    return d.target.kind != 'provider' || connection.providerSlug == d.target.providerSlug;
  });

  connections.sort(
    (a, b) =>
      b.priority - a.priority ||
      statusRank[a.status] - statusRank[b.status] ||
      Number(b.providerSlug == d.model.labSlug) - Number(a.providerSlug == d.model.labSlug) ||
      a.createdAt.getTime() - b.createdAt.getTime()
  );

  return connections.map(connection => {
    let offering = pickOffering(
      d.offerings.get(connection.providerSlug)!,
      d.target.kind == 'provider' ? d.target.vendorModelId : undefined
    )!;

    // The customer pays the provider directly, so what they are billed and what the provider
    // charges are the same price.
    let pricing = applyConnectionPricing({
      override: connection.pricingOverride,
      modelSlug: d.model.slug,
      pricing: offering.pricing
    });

    return {
      billedProviderSlug: connection.providerSlug,
      providerSlug: connection.providerSlug,
      connectionId: connection.id,
      connectionOwner: 'customer' as const,
      offeringId: offering.id,
      vendorModelId: offering.vendorModelId,
      billedPricing: pricing.pricing,
      billedPricingSource: pricing.overridden
        ? ('connection' as const)
        : ('offering' as const),
      providerPricing: pricing.pricing
    };
  });
};

let metorialCandidates = (d: {
  model: { slug: string; labSlug: string };
  requiredFeatures: ProviderFeature[];
  rules: RoutingRuleOption[];
  offerings: Map<string, OfferingOption[]>;
  random: () => number;
}): RouteCandidate[] => {
  let matching = d.rules.filter(
    rule =>
      isUsable(rule.connection.status) &&
      d.offerings.has(rule.connection.providerSlug) &&
      hasFeatures(rule.connection.features, d.requiredFeatures) &&
      (rule.modelSlug ? rule.modelSlug == d.model.slug : rule.labSlug == d.model.labSlug)
  );

  // Model rules beat lab rules, then higher priority wins; rules tied on both share traffic by
  // weight.
  let tierOf = (rule: RoutingRuleOption) => [rule.modelSlug ? 0 : 1, -rule.priority] as const;
  let compareTiers = (a: RoutingRuleOption, b: RoutingRuleOption) => {
    let [specificA, priorityA] = tierOf(a);
    let [specificB, priorityB] = tierOf(b);

    return specificA - specificB || priorityA - priorityB;
  };

  let sorted = [...matching].sort(compareTiers);
  let tiers: RoutingRuleOption[][] = [];
  for (let rule of sorted) {
    let tier = tiers[tiers.length - 1];
    if (tier && compareTiers(tier[0]!, rule) == 0) tier.push(rule);
    else tiers.push([rule]);
  }

  let ordered = tiers.flatMap(tier => weightedOrder(tier, d.random));

  let seenConnections = new Set<string>();

  return ordered.flatMap(rule => {
    if (seenConnections.has(rule.connection.slug)) return [];
    seenConnections.add(rule.connection.slug);

    let offering = pickOffering(d.offerings.get(rule.connection.providerSlug)!)!;

    return [
      {
        billedProviderSlug: 'metorial',
        providerSlug: rule.connection.providerSlug,
        connectionOwner: 'platform' as const,
        platformConnectionSlug: rule.connection.slug,
        offeringId: offering.id,
        vendorModelId: offering.vendorModelId,
        routingRuleSlug: rule.slug,
        billedPricing: rule.pricingOverride ?? offering.pricing,
        billedPricingSource: rule.pricingOverride
          ? ('routing_rule' as const)
          : ('offering' as const),
        providerPricing: offering.pricing
      }
    ];
  });
};

// Customer keys come first: someone who connected their own provider expects to be billed by that
// provider, and the metorial provider is the fallback (or the only route when nothing else serves
// the model). Pinning a provider never falls back to metorial, and `metorial:` never to a customer
// key.
export let selectCandidates = (d: {
  model: { slug: string; labSlug: string };
  target: RouteTarget;
  offerings: OfferingOption[];
  connections: CustomerConnectionOption[];
  rules: RoutingRuleOption[];
  metorialEnabled: boolean;
  requiredFeatures?: ProviderFeature[];
  random?: () => number;
}): RouteCandidate[] => {
  let offerings = groupByProvider(d.offerings);
  let random = d.random ?? Math.random;
  let requiredFeatures = d.requiredFeatures ?? [];

  let customer =
    d.target.kind == 'metorial'
      ? []
      : customerCandidates({
          model: d.model,
          target: d.target,
          requiredFeatures,
          connections: d.connections,
          offerings
        });

  let metorial =
    d.target.kind == 'provider' || !d.metorialEnabled
      ? []
      : metorialCandidates({
          model: d.model,
          requiredFeatures,
          rules: d.rules,
          offerings,
          random
        });

  return [...customer, ...metorial];
};
