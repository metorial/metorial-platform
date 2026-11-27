import { describe, expect, it } from 'vitest';
import { getNiceScale } from './scale';

describe('getNiceScale', () => {
  it('starts at zero for positive data and rounds the max up to a nice step', () => {
    expect(getNiceScale(0.2, 2.1, { tickCount: 5 })).toEqual({
      min: 0,
      max: 2.5,
      tickAmount: 5
    });
    expect(getNiceScale(3, 54, { tickCount: 5 })).toEqual({ min: 0, max: 60, tickAmount: 3 });
  });

  it('picks a finer step when it avoids a mostly empty top of the chart', () => {
    expect(getNiceScale(0, 2.1, { tickCount: 4 })).toEqual({
      min: 0,
      max: 2.5,
      tickAmount: 5
    });
    expect(getNiceScale(0, 2.1, { tickCount: 2 })).toEqual({ min: 0, max: 3, tickAmount: 3 });
  });

  it('keeps a value that already sits on a step', () => {
    expect(getNiceScale(0, 100, { tickCount: 4 })).toEqual({
      min: 0,
      max: 100,
      tickAmount: 4
    });
  });

  it('uses binary steps for byte values', () => {
    let gib = 1024 ** 3;

    expect(getNiceScale(0, 4.2 * gib, { tickCount: 5, binary: true })).toEqual({
      min: 0,
      max: 5 * gib,
      tickAmount: 5
    });
  });

  it('can start above zero when asked to', () => {
    expect(getNiceScale(50, 100, { tickCount: 4, includeZero: false })).toEqual({
      min: 50,
      max: 100,
      tickAmount: 5
    });
  });

  it('includes negative values and falls back for empty or flat data', () => {
    expect(getNiceScale(-3, 7, { tickCount: 5 })).toEqual({ min: -4, max: 8, tickAmount: 6 });
    expect(getNiceScale(0, 0, { tickCount: 4 })).toEqual({ min: 0, max: 1, tickAmount: 4 });
    expect(getNiceScale(Infinity, -Infinity)).toEqual({ min: 0, max: 1, tickAmount: 4 });
  });
});
