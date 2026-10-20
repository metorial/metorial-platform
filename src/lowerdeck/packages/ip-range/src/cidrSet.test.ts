import { describe, expect, it } from 'vitest';
import {
  cidrSetEqualsUniverse,
  cidrSetIntersect,
  cidrSetIsEmpty,
  cidrSetNormalize,
  cidrSetSubtract,
  cidrSetUnion,
  emptyCidr,
  universeCidr
} from './cidrSet';

describe('cidrSet', () => {
  it('unions overlapping cidrs', () => {
    expect(cidrSetUnion(['10.0.0.0/24', '10.0.1.0/24'])).toEqual(['10.0.0.0/23']);
  });

  it('subtracts a nested cidr', () => {
    let result = cidrSetSubtract(['10.0.0.0/8'], ['10.0.0.0/24']);

    expect(result).toContain('10.0.1.0/24');
    expect(result).not.toContain('10.0.0.0/24');
    expect(cidrSetIntersect(result, ['10.0.0.0/24'])).toEqual([]);
  });

  it('intersects overlapping cidrs', () => {
    expect(cidrSetIntersect(['10.0.0.0/8'], ['10.0.0.0/24'])).toEqual(['10.0.0.0/24']);
  });

  it('detects empty and universe sets', () => {
    expect(cidrSetIsEmpty([])).toBe(true);
    expect(cidrSetEqualsUniverse(['0.0.0.0/0'], 'ipv4')).toBe(true);
    expect(cidrSetEqualsUniverse(['10.0.0.0/8'], 'ipv4')).toBe(false);
  });

  it('normalizes duplicate cidrs', () => {
    expect(cidrSetNormalize(['10.0.0.0/24', '10.0.0.0/24'])).toEqual(['10.0.0.0/24']);
  });

  it('handles ipv6 universe and empty sentinels', () => {
    expect(universeCidr('ipv6')).toBe('::/0');
    expect(emptyCidr('ipv6')).toBe('::/128');
  });
});
