import type { GatewayUsage, Pricing } from '@mtsrc/ai-gateway-spec';
import { describe, expect, it } from 'vitest';
import { computeCost } from '../src';

let pricing = (overrides: Partial<Pricing> = {}): Pricing => ({
  currency: 'USD',
  text: {
    input: 3,
    output: 15,
    cacheRead: 0.3,
    cacheWrite: [
      { ttl: '5m', price: 3.75 },
      { ttl: '1h', price: 6 }
    ],
    reasoning: null
  },
  image: null,
  audio: null,
  video: null,
  contextTiers: [],
  units: [],
  webSearchPer1k: null,
  ...overrides
});

let usage = (d: {
  noCache?: number;
  cacheRead?: number;
  cacheWrite?: number;
  text?: number;
  reasoning?: number;
}): GatewayUsage => {
  let noCache = d.noCache ?? 0;
  let cacheRead = d.cacheRead ?? 0;
  let cacheWrite = d.cacheWrite ?? 0;
  let text = d.text ?? 0;
  let reasoning = d.reasoning ?? 0;

  return {
    input: { total: noCache + cacheRead + cacheWrite, noCache, cacheRead, cacheWrite },
    output: { total: text + reasoning, text, reasoning }
  };
};

describe('computeCost', () => {
  it('prices each component per million tokens', () => {
    let cost = computeCost({
      pricing: pricing(),
      usage: usage({ noCache: 1_000_000, cacheRead: 1_000_000, text: 1_000_000 })
    });

    expect(cost.priced).toBe(true);
    expect(cost.components.input).toBeCloseTo(3);
    expect(cost.components.cacheRead).toBeCloseTo(0.3);
    expect(cost.components.output).toBeCloseTo(15);
    expect(cost.totalUsd).toBeCloseTo(18.3);
  });

  it('bills reasoning at the output rate when no reasoning rate is published', () => {
    let cost = computeCost({ pricing: pricing(), usage: usage({ reasoning: 2_000_000 }) });

    expect(cost.components.reasoning).toBeCloseTo(30);
  });

  it('uses the dedicated reasoning rate when one exists', () => {
    let base = pricing();
    let cost = computeCost({
      pricing: pricing({ text: { ...base.text!, reasoning: 10 } }),
      usage: usage({ reasoning: 1_000_000 })
    });

    expect(cost.components.reasoning).toBeCloseTo(10);
  });

  it('picks the cache write rate for the requested ttl and falls back to the untyped one', () => {
    let fiveMinutes = computeCost({
      pricing: pricing(),
      usage: usage({ cacheWrite: 1_000_000 }),
      cacheWriteTtl: '5m'
    });
    let oneHour = computeCost({
      pricing: pricing(),
      usage: usage({ cacheWrite: 1_000_000 }),
      cacheWriteTtl: '1h'
    });

    expect(fiveMinutes.components.cacheWrite).toBeCloseTo(3.75);
    expect(oneHour.components.cacheWrite).toBeCloseTo(6);
  });

  it('falls back to the input rate for cache reads and writes without a published rate', () => {
    let base = pricing();
    let cost = computeCost({
      pricing: pricing({ text: { ...base.text!, cacheRead: null, cacheWrite: [] } }),
      usage: usage({ cacheRead: 1_000_000, cacheWrite: 1_000_000 })
    });

    expect(cost.components.cacheRead).toBeCloseTo(3);
    expect(cost.components.cacheWrite).toBeCloseTo(3);
  });

  it('applies the highest context tier the input reaches', () => {
    let cost = computeCost({
      pricing: pricing({
        contextTiers: [
          { minInputTokens: 200_000, input: 6, output: 22.5, cacheRead: 0.6 },
          { minInputTokens: 1_000_000, input: 9, output: 30, cacheRead: 0.9 }
        ]
      }),
      usage: usage({ noCache: 300_000, text: 1_000_000 })
    });

    expect(cost.components.input).toBeCloseTo(1.8);
    expect(cost.components.output).toBeCloseTo(22.5);
  });

  it('is unpriced when a component with tokens has no rate', () => {
    let base = pricing();
    let cost = computeCost({
      pricing: pricing({ text: { ...base.text!, output: null } }),
      usage: usage({ noCache: 1000, text: 1000 })
    });

    expect(cost.priced).toBe(false);
  });

  it('stays priced when the unknown rate belongs to a component without tokens', () => {
    let base = pricing();
    let cost = computeCost({
      pricing: pricing({ text: { ...base.text!, output: null } }),
      usage: usage({ noCache: 1000 })
    });

    expect(cost.priced).toBe(true);
  });

  it('is unpriced without pricing or text rates', () => {
    expect(computeCost({ pricing: null, usage: usage({ noCache: 1 }) }).priced).toBe(false);
    expect(computeCost({ pricing: pricing({ text: null }), usage: usage({}) }).priced).toBe(
      false
    );
  });
});
