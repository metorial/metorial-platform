import { describe, expect, it } from 'vitest';
import { percentile, ratio, summarize } from '../../src/lib/stats';

describe('percentiles', () => {
  it('interpolates between closest ranks', () => {
    let values = Array.from({ length: 101 }, (_, index) => index);

    expect(percentile(values, 50)).toBe(50);
    expect(percentile(values, 95)).toBe(95);
    expect(percentile(values, 99)).toBe(99);
    expect(percentile([10, 20], 50)).toBe(15);
    expect(percentile([10, 20, 30, 40], 95)).toBeCloseTo(38.5);
  });

  it('handles empty and single samples', () => {
    expect(percentile([], 95)).toBeNull();
    expect(percentile([7], 99)).toBe(7);
    expect(summarize([])).toEqual({
      count: 0,
      min: null,
      max: null,
      mean: null,
      p50: null,
      p95: null,
      p99: null
    });
  });

  it('summarizes unsorted input without changing it', () => {
    let values = [5, 1, 4, 2, 3];
    let summary = summarize(values);

    expect(values).toEqual([5, 1, 4, 2, 3]);
    expect(summary).toMatchObject({ count: 5, min: 1, max: 5, mean: 3, p50: 3 });
    expect(summary.p95).toBeCloseTo(4.8);
  });

  it('guards ratios against empty denominators', () => {
    expect(ratio(1, 0)).toBe(0);
    expect(ratio(1, 4)).toBe(0.25);
  });
});
