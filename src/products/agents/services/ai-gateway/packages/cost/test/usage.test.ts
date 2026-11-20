import { describe, expect, it } from 'vitest';
import { normalizeUsage } from '../src';

let reported = (d: {
  input?: Partial<Record<'total' | 'noCache' | 'cacheRead' | 'cacheWrite', number>>;
  output?: Partial<Record<'total' | 'text' | 'reasoning', number>>;
}) => ({
  inputTokens: {
    total: d.input?.total,
    noCache: d.input?.noCache,
    cacheRead: d.input?.cacheRead,
    cacheWrite: d.input?.cacheWrite
  },
  outputTokens: {
    total: d.output?.total,
    text: d.output?.text,
    reasoning: d.output?.reasoning
  }
});

describe('normalizeUsage', () => {
  it('derives uncached input from the total when only cache counts are reported', () => {
    let usage = normalizeUsage(
      reported({ input: { total: 1000, cacheRead: 600, cacheWrite: 100 } })
    );

    expect(usage.input).toEqual({
      total: 1000,
      noCache: 300,
      cacheRead: 600,
      cacheWrite: 100
    });
  });

  it('rebuilds the input total from the split when the provider reports one', () => {
    let usage = normalizeUsage(
      reported({ input: { noCache: 50, cacheRead: 200, cacheWrite: 25 } })
    );

    expect(usage.input.total).toBe(275);
  });

  it('prefers the reported split over a total that disagrees with it', () => {
    let usage = normalizeUsage(reported({ input: { total: 10, noCache: 40, cacheRead: 60 } }));

    expect(usage.input).toEqual({ total: 100, noCache: 40, cacheRead: 60, cacheWrite: 0 });
  });

  it('separates reasoning from text output', () => {
    let usage = normalizeUsage(reported({ output: { total: 500, reasoning: 320 } }));

    expect(usage.output).toEqual({ total: 500, text: 180, reasoning: 320 });
  });

  it('treats missing, negative and non-finite counts as zero', () => {
    let usage = normalizeUsage(
      reported({ input: { total: Number.NaN, cacheRead: -5 }, output: { total: Infinity } })
    );

    expect(usage).toEqual({
      input: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
      output: { total: 0, text: 0, reasoning: 0 }
    });
  });

  it('never yields negative uncached input when cache counts exceed the total', () => {
    let usage = normalizeUsage(reported({ input: { total: 100, cacheRead: 150 } }));

    expect(usage.input.noCache).toBe(0);
    expect(usage.input.total).toBe(150);
  });
});
