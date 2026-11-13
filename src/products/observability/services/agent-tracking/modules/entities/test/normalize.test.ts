import { isServiceError } from '@lowerdeck/error';
import { describe, expect, it } from 'vitest';
import {
  emailsOf,
  isValidSlug,
  normalizeEmail,
  normalizeIdentifier,
  normalizeIdentifiers,
  normalizeSlug
} from '../src/lib/normalize';

let thrown = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error;
  }

  return undefined;
};

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  John.Doe@ACME.com ')).toBe('john.doe@acme.com');
  });
});

describe('normalizeIdentifier', () => {
  it('lowercases email and remote values', () => {
    expect(normalizeIdentifier({ type: 'Email', value: ' John@Acme.COM ' })).toEqual({
      type: 'email',
      value: 'john@acme.com'
    });
    expect(normalizeIdentifier({ type: 'email:cursor', value: 'A@B.C' }).value).toBe('a@b.c');
    expect(normalizeIdentifier({ type: 'remote', value: 'GitHub.com/Acme/API' }).value).toBe(
      'github.com/acme/api'
    );
  });

  it('keeps the case of other values', () => {
    expect(normalizeIdentifier({ type: 'account:claude_code', value: ' AbC-123 ' })).toEqual({
      type: 'account:claude_code',
      value: 'AbC-123'
    });
  });

  it('rejects empty identifiers', () => {
    let error = thrown(() => normalizeIdentifier({ type: 'email', value: '  ' }));

    expect(isServiceError(error)).toBe(true);
  });

  it('dedupes after normalizing', () => {
    let identifiers = normalizeIdentifiers([
      { type: 'email', value: 'a@b.c' },
      { type: 'EMAIL', value: 'A@B.C' },
      { type: 'account:x', value: '1' }
    ]);

    expect(identifiers).toEqual([
      { type: 'email', value: 'a@b.c' },
      { type: 'account:x', value: '1' }
    ]);
    expect(emailsOf(identifiers)).toEqual(['a@b.c']);
  });
});

describe('slugs', () => {
  it('accepts lowercase slugs with separators', () => {
    expect(isValidSlug('billing')).toBe(true);
    expect(isValidSlug('cc-4100')).toBe(true);
    expect(isValidSlug('team_a.web')).toBe(true);
    expect(isValidSlug('9lives')).toBe(true);
  });

  it('rejects invalid slugs', () => {
    expect(isValidSlug('-billing')).toBe(false);
    expect(isValidSlug('.hidden')).toBe(false);
    expect(isValidSlug('with space')).toBe(false);
    expect(isValidSlug('Billing')).toBe(false);
    expect(isValidSlug('')).toBe(false);
    expect(isValidSlug('a'.repeat(65))).toBe(false);
  });

  it('normalizes case and whitespace before validating', () => {
    expect(normalizeSlug('  Billing-Revamp ')).toBe('billing-revamp');
    expect(isServiceError(thrown(() => normalizeSlug('no/slashes')))).toBe(true);
  });
});
