import { describe, expect, it } from 'vitest';
import {
  findResourceSizeOption,
  formatResourceSize,
  getDefaultResourceSizeOption,
  getPrimaryChoices,
  getSecondaryChoices,
  type ResourceSizeDimensions,
  type ResourceSizeOption,
  selectPrimaryValue
} from './lib';

type Dimension = 'cpus' | 'memory';

let dimensions: ResourceSizeDimensions<Dimension> = [
  { id: 'cpus', label: 'vCPU', formatSummary: value => `${value} vCPU` },
  { id: 'memory', label: 'Memory', formatSummary: value => `${value} GiB` }
];

let option = (
  id: string,
  cpus: number,
  memory: number,
  available = true
): ResourceSizeOption<Dimension> => ({
  id,
  values: { cpus, memory },
  available,
  unavailableReason: available ? undefined : `${id} locked`
});

let options = [
  option('c2m4', 2, 4),
  option('c1m2', 1, 2),
  option('c1m1', 1, 1),
  option('c2m2', 2, 2),
  option('c2m8', 2, 8, false),
  option('c4m8', 4, 8),
  option('c4m16', 4, 16),
  option('c8m16', 8, 16, false),
  option('c8m32', 8, 32, false)
];

let byId = (id: string) => options.find(entry => entry.id == id)!;

describe('getPrimaryChoices', () => {
  it('returns unique sorted primary values', () => {
    expect(getPrimaryChoices(options, dimensions).map(choice => choice.value)).toEqual([
      1, 2, 4, 8
    ]);
  });

  it('marks a value available when any option with it is available', () => {
    let choices = getPrimaryChoices(options, dimensions);
    expect(choices.find(choice => choice.value == 2)).toMatchObject({ available: true });
    expect(choices.find(choice => choice.value == 8)).toMatchObject({
      available: false,
      unavailableReason: 'c8m16 locked'
    });
  });
});

describe('getSecondaryChoices', () => {
  it('narrows to the options with the primary value, sorted', () => {
    let choices = getSecondaryChoices(options, dimensions, 2);
    expect(choices.map(choice => [choice.value, choice.available])).toEqual([
      [2, true],
      [4, true],
      [8, false]
    ]);
    expect(choices[2]?.unavailableReason).toBe('c2m8 locked');
  });

  it('returns nothing for an unknown primary value', () => {
    expect(getSecondaryChoices(options, dimensions, 3)).toEqual([]);
  });
});

describe('findResourceSizeOption', () => {
  it('finds the exact combination', () => {
    expect(findResourceSizeOption(options, dimensions, 4, 16)?.id).toBe('c4m16');
    expect(findResourceSizeOption(options, dimensions, 4, 4)).toBeUndefined();
  });
});

describe('selectPrimaryValue', () => {
  it('keeps the current secondary value when it exists', () => {
    expect(selectPrimaryValue(options, dimensions, 1, byId('c2m2'))?.id).toBe('c1m2');
  });

  it('picks the smallest larger available secondary value', () => {
    expect(selectPrimaryValue(options, dimensions, 4, byId('c2m4'))?.id).toBe('c4m8');
  });

  it('ignores an unavailable exact match', () => {
    expect(selectPrimaryValue(options, dimensions, 2, byId('c4m8'))?.id).toBe('c2m4');
  });

  it('falls back to the largest available value', () => {
    expect(selectPrimaryValue(options, dimensions, 1, byId('c4m16'))?.id).toBe('c1m2');
  });

  it('picks the smallest available option without a current selection', () => {
    expect(selectPrimaryValue(options, dimensions, 2, null)?.id).toBe('c2m2');
  });

  it('returns null when nothing is available', () => {
    expect(selectPrimaryValue(options, dimensions, 8, byId('c4m16'))).toBeNull();
  });
});

describe('getDefaultResourceSizeOption', () => {
  it('returns the smallest available option', () => {
    expect(getDefaultResourceSizeOption(options, dimensions)?.id).toBe('c1m1');
  });

  it('returns null when nothing is available', () => {
    expect(
      getDefaultResourceSizeOption(
        options.map(entry => ({ ...entry, available: false })),
        dimensions
      )
    ).toBeNull();
  });
});

describe('formatResourceSize', () => {
  it('formats each dimension with its summary formatter', () => {
    expect(formatResourceSize(byId('c4m8'), dimensions)).toBe('4 vCPU · 8 GiB');
  });

  it('falls back to raw values and accepts a separator', () => {
    let plain: ResourceSizeDimensions<Dimension> = [
      { id: 'cpus', label: 'vCPU' },
      { id: 'memory', label: 'Memory' }
    ];
    expect(formatResourceSize(byId('c4m8'), plain, ' / ')).toBe('4 / 8');
  });
});
