import { describe, expect, it } from 'vitest';
import { normalizeEmail } from './normalizeEmail';

describe('normalizeEmail', () => {
  it('lowercases, trims, and normalizes gmail addresses', () => {
    expect(normalizeEmail('  User.Name+tag@Gmail.com  ')).toBe('username@gmail.com');
    expect(normalizeEmail('user@googlemail.com')).toBe('user@gmail.com');
  });

  it('strips plus aliases for non-gmail domains', () => {
    expect(normalizeEmail('user+alias@example.com')).toBe('user@example.com');
  });

  it('rejects invalid addresses', () => {
    expect(() => normalizeEmail('not-an-email')).toThrow('Invalid email');
  });
});
