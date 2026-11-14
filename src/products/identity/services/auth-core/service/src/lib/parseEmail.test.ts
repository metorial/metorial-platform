import { describe, expect, it } from 'vitest';
import { parseEmail } from './parseEmail';

describe('parseEmail', () => {
  it('lowercases and splits a well formed address', () => {
    expect(parseEmail('  User@Example.COM ')).toEqual({
      email: 'user@example.com',
      domain: 'example.com',
      normalizedEmail: 'user@example.com'
    });
  });

  it('rejects addresses with more than one @', () => {
    // Reading only the first two segments would report example.com as the
    // domain and let this address pass a check on a configured domain.
    expect(() => parseEmail('attacker@example.com@evil.com')).toThrow('Invalid email');
  });

  it('rejects addresses missing a local part or domain', () => {
    expect(() => parseEmail('@example.com')).toThrow('Invalid email');
    expect(() => parseEmail('user@')).toThrow('Invalid email');
    expect(() => parseEmail('user')).toThrow('Invalid email');
  });

  it('rejects addresses containing whitespace', () => {
    expect(() => parseEmail('user@exa mple.com')).toThrow('Invalid email');
  });
});
