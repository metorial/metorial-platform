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
      headers: { Authorization: 'Bearer 123SECRET' }, // whole-value match only, not substring
      query: { key: '$$MT$secret$authConfig$nested.token2' }
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

  it('detects a placeholder nested in an object', () => {
    expect(containsSecretPlaceholder({ headers: { Authorization: '$$MT$secret$authConfig$token' } })).toBe(
      true
    );
  });

  it('detects a placeholder nested in an array', () => {
    expect(containsSecretPlaceholder(['plain', '$$MT$secret$authConfig$token'])).toBe(true);
  });

  it('returns false when there is no placeholder', () => {
    expect(containsSecretPlaceholder({ headers: { Authorization: 'Bearer plain-value' } })).toBe(
      false
    );
  });

  it('returns false for undefined/null', () => {
    expect(containsSecretPlaceholder(undefined)).toBe(false);
    expect(containsSecretPlaceholder(null)).toBe(false);
  });
});
