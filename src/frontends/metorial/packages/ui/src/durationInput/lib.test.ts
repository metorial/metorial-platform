import { describe, expect, it } from 'vitest';
import { getDurationParts, pickDurationUnit } from './lib';

describe('pickDurationUnit', () => {
  it('picks the largest unit that divides the value evenly', () => {
    expect(pickDurationUnit(45)).toBe('seconds');
    expect(pickDurationUnit(300)).toBe('minutes');
    expect(pickDurationUnit(7200)).toBe('hours');
    expect(pickDurationUnit(172800)).toBe('days');
    expect(pickDurationUnit(5400)).toBe('minutes');
  });

  it('defaults to minutes for empty values', () => {
    expect(pickDurationUnit(null)).toBe('minutes');
    expect(pickDurationUnit(0)).toBe('minutes');
    expect(pickDurationUnit(null, ['hours', 'days'])).toBe('hours');
  });

  it('respects the allowed units', () => {
    expect(pickDurationUnit(172800, ['minutes', 'hours'])).toBe('hours');
    expect(pickDurationUnit(90, ['minutes', 'hours'])).toBe('minutes');
  });
});

describe('getDurationParts', () => {
  it('splits seconds into amount and unit', () => {
    expect(getDurationParts(600)).toEqual({ amount: 10, unit: 'minutes' });
    expect(getDurationParts(90, ['minutes'])).toEqual({ amount: 1.5, unit: 'minutes' });
  });
});
