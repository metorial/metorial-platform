import { describe, expect, it } from 'vitest';
import { combineConfigs, intersectBooleans, intersectStringArrays } from './combineConfigs';

describe('combineConfigs', () => {
  it('intersects allowed file extensions and boolean flags', () => {
    let combined = combineConfigs(
      [
        {
          allowScripts: true,
          allowedFileExtensions: ['ts', 'js'],
          allowNonStandardDirectories: true
        },
        {
          allowScripts: false,
          allowedFileExtensions: ['ts', 'json'],
          allowNonStandardDirectories: true
        }
      ],
      null
    );

    expect(combined).toEqual({
      allowScripts: false,
      allowedFileExtensions: ['ts'],
      allowNonStandardDirectories: true
    });
  });

  it('returns defaults when no configs are provided', () => {
    expect(combineConfigs([], null)).toEqual({
      allowScripts: true,
      allowedFileExtensions: [],
      allowNonStandardDirectories: true
    });
  });
});

describe('intersectStringArrays', () => {
  it('returns the intersection across arrays', () => {
    expect(intersectStringArrays([['a', 'b'], ['b', 'c']])).toEqual(['b']);
  });
});

describe('intersectBooleans', () => {
  it('requires all values to be true', () => {
    expect(intersectBooleans([true, true, false])).toBe(false);
    expect(intersectBooleans([true, true])).toBe(true);
  });
});
