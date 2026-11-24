import { v } from '@lowerdeck/validation';
import type { Pricing } from '@metorial/model-catalog/src/types';

export type {
  CacheWriteRate,
  ContextTier,
  Pricing,
  TokenRates,
  UnitPrice
} from '@metorial/model-catalog/src/types';

let rate = v.nullable(v.number({ modifiers: [v.minValue(0)] }));

let tokenRates = v.nullable(
  v.object({
    input: rate,
    output: rate,
    cacheRead: rate,
    cacheWrite: v.array(
      v.object({
        ttl: v.nullable(v.string()),
        price: v.number({ modifiers: [v.minValue(0)] })
      })
    ),
    reasoning: rate
  })
);

export let pricingSchema = v.object({
  currency: v.literal('USD'),
  text: tokenRates,
  image: tokenRates,
  audio: tokenRates,
  video: tokenRates,
  contextTiers: v.array(
    v.object({
      minInputTokens: v.number({ modifiers: [v.integer(), v.minValue(0)] }),
      input: rate,
      output: rate,
      cacheRead: rate
    })
  ),
  units: v.array(
    v.object({
      modality: v.enumOf(['text', 'image', 'audio', 'video']),
      direction: v.enumOf(['input', 'output']),
      unit: v.string(),
      price: v.number({ modifiers: [v.minValue(0)] })
    })
  ),
  webSearchPer1k: rate
});

export let connectionPricingOverrideSchema = v.object({
  multiplier: v.optional(v.number({ modifiers: [v.minValue(0), v.maxValue(100)] })),
  models: v.optional(v.record(pricingSchema))
});

export type ConnectionPricingOverride = {
  multiplier?: number;
  models?: Record<string, Pricing>;
};

export let pricingSource = ['offering', 'connection', 'routing_rule'] as const;

export type PricingSource = (typeof pricingSource)[number];

export type ResolvedPricing = {
  pricing: Pricing | null;
  source: PricingSource;
};
