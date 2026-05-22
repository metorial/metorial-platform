import { describe, expect, it } from 'vitest';
import { normalizeSearchQuery } from './searchQuery';

describe('normalizeSearchQuery', () => {
  it('strips symbols and collapses whitespace', () => {
    expect(normalizeSearchQuery('  hello   world!!  ')).toBe('hello world');
  });

  it('truncates long queries', () => {
    let long = 'a'.repeat(600);
    expect(normalizeSearchQuery(long).length).toBe(512);
  });
});
