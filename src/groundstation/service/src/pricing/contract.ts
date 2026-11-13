import type { Pricing } from '@metorial/model-catalog/src/types';
import { computeRequestCost, type RequestTokens } from '../catalog/cost';
import { parseAmount, type Amount } from '../sessions/decimal';
import type { MatchableOverride } from './match';

let amountScale = 10n ** 18n;

export type OverridePricing = Pick<MatchableOverride, 'kind' | 'multiplier' | 'rates'>;

let zeroPricing = (): Pricing => ({
  currency: 'USD',
  text: { input: 0, output: 0, cacheRead: 0, cacheWrite: [], reasoning: 0 },
  image: null,
  audio: null,
  video: null,
  contextTiers: [],
  units: [],
  webSearchPer1k: null
});

// `undefined` means the override can't price this request (a multiplier without a list cost, or
// rates without token counts), so the request keeps only its list cost.
export let contractAmount = (d: {
  override: OverridePricing;
  list: Amount | undefined;
  tokens: RequestTokens | undefined;
  contextTokens: number;
}): Amount | undefined => {
  if (d.override.kind == 'included') return 0n;

  if (d.override.kind == 'multiplier') {
    let multiplier = parseAmount(d.override.multiplier);
    if (d.list === undefined || multiplier === undefined) return undefined;

    return (d.list * multiplier) / amountScale;
  }

  if (!d.tokens) return undefined;

  let cost = computeRequestCost({
    pricing: d.override.rates,
    tokens: d.tokens,
    contextTokens: d.contextTokens
  });

  return cost === undefined ? undefined : parseAmount(cost);
};

let scaleRate = (rate: number | null, factor: number) =>
  rate === null ? null : rate * factor;

let scaleTokenRates = (rates: Pricing['text'], factor: number): Pricing['text'] =>
  rates
    ? {
        input: scaleRate(rates.input, factor),
        output: scaleRate(rates.output, factor),
        cacheRead: scaleRate(rates.cacheRead, factor),
        cacheWrite: rates.cacheWrite.map(rate => ({ ...rate, price: rate.price * factor })),
        reasoning: scaleRate(rates.reasoning, factor)
      }
    : null;

export let scalePricing = (pricing: Pricing, factor: number): Pricing => ({
  ...pricing,
  text: scaleTokenRates(pricing.text, factor),
  image: scaleTokenRates(pricing.image, factor),
  audio: scaleTokenRates(pricing.audio, factor),
  video: scaleTokenRates(pricing.video, factor),
  contextTiers: pricing.contextTiers.map(tier => ({
    ...tier,
    input: scaleRate(tier.input, factor),
    output: scaleRate(tier.output, factor),
    cacheRead: scaleRate(tier.cacheRead, factor)
  })),
  units: pricing.units.map(unit => ({ ...unit, price: unit.price * factor })),
  webSearchPer1k: scaleRate(pricing.webSearchPer1k, factor)
});

export let effectivePricing = (d: {
  list: Pricing | null;
  override: OverridePricing | null;
}): Pricing | null => {
  if (!d.override) return d.list;
  if (d.override.kind == 'rates') return d.override.rates;
  if (d.override.kind == 'included') return scalePricing(d.list ?? zeroPricing(), 0);

  return d.list ? scalePricing(d.list, Number(d.override.multiplier)) : null;
};
