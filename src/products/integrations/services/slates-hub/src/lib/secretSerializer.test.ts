import { describe, expect, it } from 'vitest';
import { AuthConfigSecretSerializer, containsSecretPlaceholder } from './secretSerializer';

describe('AuthConfigSecretSerializer', () => {
  let authConfig = { token: '123SECRET', nested: { token2: 'also_secret' } };

  it('serializes header/query values that match a secret to placeholders', () => {
    let serializer = new AuthConfigSecretSerializer(authConfig);

    expect(
      serializer.serialize({
        headers: { Authorization: 'Bearer 123SECRET' },
        query: { key: 'also_secret' }
      })
    ).toEqual({
      headers: { Authorization: 'Bearer $$MT$secret$authConfig$token$$' },
      query: { key: '$$MT$secret$authConfig$nested.token2' }
    });
  });

  it.each([
    ['Bearer 123SECRET', 'Bearer $$MT$secret$authConfig$token$$'],
    ['123SECRET suffix', '$$MT$secret$authConfig$token$$ suffix'],
    ['prefix 123SECRET suffix', 'prefix $$MT$secret$authConfig$token$$ suffix'],
    ['123SECRET/123SECRET', '$$MT$secret$authConfig$token$$/$$MT$secret$authConfig$token$$']
  ])('round-trips embedded secrets in %s', (value, expected) => {
    let serializer = new AuthConfigSecretSerializer(authConfig);
    expect(serializer.serialize(value)).toBe(expected);
    expect(serializer.deserialize(expected)).toBe(value);
  });

  it('prefers longer overlapping secrets and treats regex characters literally', () => {
    let serializer = new AuthConfigSecretSerializer({
      token: 'ABC',
      token2: 'ABCDE',
      special: 'a.*+?^${}()|[]\\z'
    });
    let value = 'ABCDE/ABC/a.*+?^${}()|[]\\z';
    let expected =
      '$$MT$secret$authConfig$token2$$/$$MT$secret$authConfig$token$$/$$MT$secret$authConfig$special$$';

    expect(serializer.serialize(value)).toBe(expected);
    expect(serializer.deserialize(expected)).toBe(value);
    expect(serializer.serialize('ABCx/aZZz')).toBe('$$MT$secret$authConfig$token$$x/aZZz');
  });

  it('does not rescan inserted placeholders during serialization', () => {
    let serializer = new AuthConfigSecretSerializer({ token: 'ABC', other: 'authConfig' });
    expect(serializer.serialize('Bearer ABC')).toBe('Bearer $$MT$secret$authConfig$token$$');
  });

  it('distinguishes a secret suffix from a longer auth path', () => {
    let serializer = new AuthConfigSecretSerializer({ token: 'ABC', token2: 'XYZ' });
    expect(serializer.serialize('ABC2')).toBe('$$MT$secret$authConfig$token$$2');
    expect(serializer.deserialize('$$MT$secret$authConfig$token$$2')).toBe('ABC2');
    expect(serializer.deserialize('$$MT$secret$authConfig$token2')).toBe('XYZ');
    expect(serializer.deserialize('Bearer $$MT$secret$authConfig$token2$$')).toBe(
      'Bearer XYZ'
    );
  });

  it.each([
    '$$MT$secret$authConfig$token2',
    '$$MT$secret$authConfig$token2$$',
    'Bearer $$MT$secret$authConfig$token2$$',
    'Bearer $$MT$secret$authConfig$token',
    'Bearer $$MT$secret$authConfig$missing$$'
  ])('does not partially resolve unknown or unterminated placeholders: %s', value => {
    let serializer = new AuthConfigSecretSerializer({ token: 'ABC' });
    expect(serializer.deserialize(value)).toBe(value);
  });

  it('does not rescan resolved secrets containing another placeholder', () => {
    let nestedPlaceholder = '$$MT$secret$authConfig$token2$$';
    let serializer = new AuthConfigSecretSerializer({
      token: nestedPlaceholder,
      token2: 'OTHER_SECRET'
    });
    expect(serializer.deserialize('$$MT$secret$authConfig$token')).toBe(nestedPlaceholder);
    expect(serializer.deserialize('Bearer $$MT$secret$authConfig$token$$')).toBe(
      `Bearer ${nestedPlaceholder}`
    );
  });

  it('escapes special characters in auth paths when deserializing', () => {
    let serializer = new AuthConfigSecretSerializer({ 'token[0]+': 'ABC' });
    expect(serializer.deserialize('Bearer $$MT$secret$authConfig$token[0]+$$')).toBe(
      'Bearer ABC'
    );
    expect(serializer.deserialize('Bearer $$MT$secret$authConfig$token0$$')).toBe(
      'Bearer $$MT$secret$authConfig$token0$$'
    );
  });

  it('resolves embedded header and query secrets against rotated auth', () => {
    let serialized = new AuthConfigSecretSerializer(authConfig).serialize({
      headers: { Authorization: 'Bearer 123SECRET' },
      query: { signature: 'prefix-also_secret-suffix' }
    });
    let rotated = new AuthConfigSecretSerializer({
      token: 'NEW_TOKEN',
      nested: { token2: 'NEW_KEY' }
    });
    expect(rotated.deserialize(serialized)).toEqual({
      headers: { Authorization: 'Bearer NEW_TOKEN' },
      query: { signature: 'prefix-NEW_KEY-suffix' }
    });
  });

  it('round-trips serialize -> deserialize back to the original secret', () => {
    let serializer = new AuthConfigSecretSerializer(authConfig);
    let serialized = serializer.serialize({ query: { key: 'also_secret' } });
    expect(serializer.deserialize(serialized)).toEqual({ query: { key: 'also_secret' } });
  });

  it('deserializes a placeholder against a freshly re-fetched auth config', () => {
    // Models the real flow: a placeholder is built once (in the libs, when the tool call
    // ran) and resolved later by the hub against a re-fetched auth config -- possibly after
    // an oauth refresh rotated the token value at the same path.
    let atCallTime = new AuthConfigSecretSerializer(authConfig);
    let placeholder = atCallTime.serialize('123SECRET');

    let freshAuthConfig = { token: 'ROTATED_TOKEN', nested: { token2: 'also_secret' } };
    let atProxyTime = new AuthConfigSecretSerializer(freshAuthConfig);
    expect(atProxyTime.deserialize(placeholder)).toBe('ROTATED_TOKEN');
  });

  it('leaves non-secret strings untouched', () => {
    let serializer = new AuthConfigSecretSerializer(authConfig);
    expect(serializer.serialize('https://example.com/file.pdf')).toBe(
      'https://example.com/file.pdf'
    );
  });

  it('recurses through arrays and nested objects', () => {
    let serializer = new AuthConfigSecretSerializer(authConfig);
    expect(serializer.serialize({ list: ['also_secret', 'plain'] })).toEqual({
      list: ['$$MT$secret$authConfig$nested.token2', 'plain']
    });
  });

  it('is a no-op on values with no matching secret', () => {
    let serializer = new AuthConfigSecretSerializer({});
    expect(serializer.serialize({ a: 'b' })).toEqual({ a: 'b' });
  });

  it('never registers an empty-string secret', () => {
    let serializer = new AuthConfigSecretSerializer({ token: '' });
    expect(serializer.serialize({ a: '', b: '' })).toEqual({ a: '', b: '' });
  });
});

describe('containsSecretPlaceholder', () => {
  it('detects a placeholder in a bare string', () => {
    expect(containsSecretPlaceholder('$$MT$secret$authConfig$token')).toBe(true);
  });

  it('detects a placeholder embedded in a larger string', () => {
    expect(containsSecretPlaceholder('Bearer $$MT$secret$authConfig$token$$')).toBe(true);
  });

  it('detects a placeholder nested in an object', () => {
    expect(
      containsSecretPlaceholder({ headers: { Authorization: '$$MT$secret$authConfig$token' } })
    ).toBe(true);
  });

  it('detects a placeholder nested in an array', () => {
    expect(containsSecretPlaceholder(['plain', '$$MT$secret$authConfig$token'])).toBe(true);
  });

  it('returns false when there is no placeholder', () => {
    expect(
      containsSecretPlaceholder({ headers: { Authorization: 'Bearer plain-value' } })
    ).toBe(false);
  });

  it('returns false for undefined/null', () => {
    expect(containsSecretPlaceholder(undefined)).toBe(false);
    expect(containsSecretPlaceholder(null)).toBe(false);
  });
});
