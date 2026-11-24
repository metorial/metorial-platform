export let decisionModelSlugs = ['clef-flash', 'clef', 'jev'] as const;

export type DecisionModelSlug = (typeof decisionModelSlugs)[number];

export type DecisionModel = {
  slug: DecisionModelSlug;
  name: string;
  description: string;
  providerSlug: string;
  vendorModelId: string;
  contextTokens: number;
  inputPricePerMillionTokens: number;
};

export let decisionProviderSlugs = {
  cloudflare: 'cloudflare-decisions',
  typesafe: 'typesafe'
} as const;

// Versions are pinned rather than tracking `-latest` aliases: confidence thresholds customers tune
// against one release drift when the alias moves.
export let decisionModels: Record<DecisionModelSlug, DecisionModel> = {
  'clef-flash': {
    slug: 'clef-flash',
    name: 'Clef-flash',
    description: "Cloudflare's fast open-weight decision model. The default for routing.",
    providerSlug: decisionProviderSlugs.cloudflare,
    vendorModelId: 'clef-flash',
    contextTokens: 64_000,
    inputPricePerMillionTokens: 0.09
  },

  clef: {
    slug: 'clef',
    name: 'Clef',
    description:
      "Cloudflare's larger decision model, slower and more precise than Clef-flash.",
    providerSlug: decisionProviderSlugs.cloudflare,
    vendorModelId: 'clef',
    contextTokens: 64_000,
    inputPricePerMillionTokens: 0.24
  },

  jev: {
    slug: 'jev',
    name: 'Jev',
    description: "TypeSafe's System One decision model. Cheapest per token, highest latency.",
    providerSlug: decisionProviderSlugs.typesafe,
    vendorModelId: 'jev-1.14.0',
    contextTokens: 64_000,
    inputPricePerMillionTokens: 0.042
  }
};

export let defaultDecisionModel: DecisionModelSlug = 'clef-flash';
