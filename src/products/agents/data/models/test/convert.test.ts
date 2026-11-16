import { describe, expect, it } from 'vitest';
import {
  cleanModelName,
  toLifecycleStatus,
  toModality,
  toPricing
} from '../src/pipeline/convert';

describe('toPricing', () => {
  it('converts token rates, cache writes and context tiers', () => {
    let pricing = toPricing({
      cost: {
        text: {
          input: {
            price: 3,
            cache: { read: 0.3, write: { '5m': 3.75, '1h': 6 } },
            overrides: [{ when: { context: { gt: 200_000 } }, price: 6, cache: { read: 0.6 } }]
          },
          output: {
            price: 15,
            overrides: [{ when: { context: { gt: 200_000 } }, price: 22.5 }]
          }
        },
        web_search: { price: 10 }
      }
    });

    expect(pricing?.text).toEqual({
      input: 3,
      output: 15,
      cacheRead: 0.3,
      cacheWrite: [
        { ttl: '5m', price: 3.75 },
        { ttl: '1h', price: 6 }
      ],
      reasoning: null
    });
    expect(pricing?.contextTiers).toEqual([
      { minInputTokens: 200_001, input: 6, output: 22.5, cacheRead: 0.6 }
    ]);
    expect(pricing?.webSearchPer1k).toBe(10);
  });

  it('keeps non-token prices as units', () => {
    let pricing = toPricing({ cost: { image: { output: { price: 0.04, unit: 'image' } } } });

    expect(pricing?.image).toBeNull();
    expect(pricing?.units).toEqual([
      { modality: 'image', direction: 'output', unit: 'image', price: 0.04 }
    ]);
  });

  it('returns null without prices', () => {
    expect(toPricing({})).toBeNull();
    expect(toPricing({ cost: {} })).toBeNull();
  });
});

describe('conversions', () => {
  it('maps MIME types to modalities', () => {
    expect(toModality('image/png')).toBe('image');
    expect(toModality('application/pdf')).toBe('pdf');
    expect(toModality('text')).toBe('text');
  });

  it('maps lifecycle states', () => {
    expect(toLifecycleStatus('deprecated')).toBe('deprecated');
    expect(toLifecycleStatus('beta')).toBe('preview');
    expect(toLifecycleStatus(undefined)).toBe('active');
  });

  it('strips only the latest marker from names', () => {
    expect(cleanModelName('Claude Haiku 3.5 (latest)', 'x')).toBe('Claude Haiku 3.5');
    expect(cleanModelName('Gemini 3 Pro (preview)', 'x')).toBe('Gemini 3 Pro (preview)');
  });
});
