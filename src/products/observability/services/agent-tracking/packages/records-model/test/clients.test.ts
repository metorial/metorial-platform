import { describe, expect, it } from 'vitest';
import { normalizeClient } from '../src/clients';

describe('normalizeClient', () => {
  it('lowercases and replaces underscores', () => {
    expect(normalizeClient('Claude_Code')).toBe('claude-code');
    expect(normalizeClient('  codex  ')).toBe('codex');
  });

  it('keeps dots and dashes', () => {
    expect(normalizeClient('my.client-1')).toBe('my.client-1');
  });

  it.each(['', ' ', '-leading', '.leading', 'has space', 'slash/ed', 'ünï', 'a'.repeat(65)])(
    'rejects %j',
    raw => {
      expect(normalizeClient(raw)).toBeNull();
    }
  );

  it('accepts the maximum length', () => {
    expect(normalizeClient('a'.repeat(64))).toBe('a'.repeat(64));
  });

  it('rejects path traversal and control characters', () => {
    expect(normalizeClient('../etc')).toBeNull();
    expect(normalizeClient('a\nb')).toBeNull();
    expect(normalizeClient('a\u0000b')).toBeNull();
  });
});
