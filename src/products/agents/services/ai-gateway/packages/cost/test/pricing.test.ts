import type { Pricing } from '@mtsrc/ai-gateway-spec';
import { describe, expect, it } from 'vitest';
import { applyConnectionPricing, scalePricing } from '../src/pricing';

let pricing: Pricing = {
  currency: 'USD',
  text: {
    input: 2,
    output: 10,
    cacheRead: 0.2,
    cacheWrite: [{ ttl: '5m', price: 2.5 }],
    reasoning: null
  },
  image: null,
  audio: null,
  video: null,
  contextTiers: [{ minInputTokens: 200_000, input: 4, output: 20, cacheRead: null }],
  units: [{ modality: 'image', direction: 'output', unit: 'image', price: 0.04 }],
  webSearchPer1k: 10,
  conditions: [
    {
      label: 'Batch',
      description: 'Batch requests',
      modality: 'text',
      rates: { input: 1, output: 5, cacheRead: null, cacheWrite: [], reasoning: null }
    }
  ]
} as Pricing;

describe('scalePricing', () => {
  it('scales every rate and keeps missing rates missing', () => {
    let scaled = scalePricing(pricing, 0.5);

    expect(scaled.text).toEqual({
      input: 1,
      output: 5,
      cacheRead: 0.1,
      cacheWrite: [{ ttl: '5m', price: 1.25 }],
      reasoning: null
    });
    expect(scaled.image).toBeNull();
    expect(scaled.contextTiers).toEqual([
      { minInputTokens: 200_000, input: 2, output: 10, cacheRead: null }
    ]);
    expect(scaled.units[0]!.price).toBe(0.02);
    expect(scaled.webSearchPer1k).toBe(5);
    expect(scaled.conditions![0]!.rates.output).toBe(2.5);
  });
});

describe('applyConnectionPricing', () => {
  let exact = scalePricing(pricing, 3);

  it('keeps the catalog price without an override', () => {
    expect(applyConnectionPricing({ override: null, modelSlug: 'm', pricing })).toEqual({
      pricing,
      overridden: false
    });
  });

  it('prefers an exact model price over the multiplier', () => {
    expect(
      applyConnectionPricing({
        override: { multiplier: 0.5, models: { m: exact } },
        modelSlug: 'm',
        pricing
      })
    ).toEqual({ pricing: exact, overridden: true });
  });

  it('applies the multiplier to other models', () => {
    let result = applyConnectionPricing({
      override: { multiplier: 0.5, models: { other: exact } },
      modelSlug: 'm',
      pricing
    });

    expect(result.overridden).toBe(true);
    expect(result.pricing!.text!.input).toBe(1);
  });

  it('cannot scale a model without catalog pricing', () => {
    expect(
      applyConnectionPricing({ override: { multiplier: 0.5 }, modelSlug: 'm', pricing: null })
    ).toEqual({ pricing: null, overridden: false });
  });
});
