import { describe, expect, it } from 'vitest';
import { unifiedLineDiff } from './lineDiff';

describe('unifiedLineDiff', () => {
  it('shows additions and removals with context', () => {
    let diff = unifiedLineDiff('a\nb\nc\nd\ne\nf\ng', 'a\nb\nc\nX\ne\nf\ng');
    expect(diff).toContain('-d');
    expect(diff).toContain('+X');
    expect(diff).toContain(' c');
  });

  it('is empty when nothing changed', () => {
    expect(unifiedLineDiff('a\nb', 'a\nb')).toBe('');
  });

  it('gives up on very large inputs', () => {
    let big = Array.from({ length: 3000 }, (_, i) => `line ${i}`).join('\n');
    expect(unifiedLineDiff(big, big + '\nmore')).toBeNull();
  });
});
