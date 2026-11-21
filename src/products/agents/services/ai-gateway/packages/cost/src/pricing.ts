import type { ConnectionPricingOverride, Pricing, TokenRates } from '@mtsrc/ai-gateway-spec';

let scaleRate = (rate: number | null, multiplier: number) =>
  rate === null ? null : rate * multiplier;

let scaleTokenRates = (rates: TokenRates, multiplier: number): TokenRates => ({
  input: scaleRate(rates.input, multiplier),
  output: scaleRate(rates.output, multiplier),
  cacheRead: scaleRate(rates.cacheRead, multiplier),
  cacheWrite: rates.cacheWrite.map(rate => ({ ...rate, price: rate.price * multiplier })),
  reasoning: scaleRate(rates.reasoning, multiplier)
});

let scaleModality = (rates: TokenRates | null, multiplier: number) =>
  rates ? scaleTokenRates(rates, multiplier) : null;

export let scalePricing = (pricing: Pricing, multiplier: number): Pricing => ({
  ...pricing,
  text: scaleModality(pricing.text, multiplier),
  image: scaleModality(pricing.image, multiplier),
  audio: scaleModality(pricing.audio, multiplier),
  video: scaleModality(pricing.video, multiplier),
  contextTiers: (pricing.contextTiers ?? []).map(tier => ({
    ...tier,
    input: scaleRate(tier.input, multiplier),
    output: scaleRate(tier.output, multiplier),
    cacheRead: scaleRate(tier.cacheRead, multiplier)
  })),
  units: (pricing.units ?? []).map(unit => ({ ...unit, price: unit.price * multiplier })),
  webSearchPer1k: scaleRate(pricing.webSearchPer1k, multiplier),
  conditions: pricing.conditions?.map(condition => ({
    ...condition,
    rates: scaleTokenRates(condition.rates, multiplier)
  }))
});

// An exact model price replaces the catalog price outright; the multiplier only scales catalog
// prices, so it never applies on top of an exact price.
export let applyConnectionPricing = (d: {
  override: ConnectionPricingOverride | null;
  modelSlug: string;
  pricing: Pricing | null;
}) => {
  let exact = d.override?.models?.[d.modelSlug];
  if (exact) return { pricing: exact, overridden: true };

  let multiplier = d.override?.multiplier;
  if (multiplier !== undefined && d.pricing) {
    return { pricing: scalePricing(d.pricing, multiplier), overridden: true };
  }

  return { pricing: d.pricing, overridden: false };
};
