import { describe, expect, test } from 'bun:test';
import { getRegistrySlatePathParams } from './registrySlatePath';

describe('getRegistrySlatePathParams', () => {
  test('derives path from full identifier', () => {
    expect(
      getRegistrySlatePathParams({
        slateFullIdentifierOnRegistry: 'metorial/apolloio',
        slateScopeIdentifierOnRegistry: 'srs_wrong',
        slateIdentifierOnRegistry: 'wrong'
      })
    ).toEqual({
      scopeId: 'metorial',
      slateId: 'apolloio'
    });
  });

  test('strips @ prefix from full identifier', () => {
    expect(
      getRegistrySlatePathParams({
        slateFullIdentifierOnRegistry: '@metorial/apolloio',
        slateScopeIdentifierOnRegistry: 'srs_wrong',
        slateIdentifierOnRegistry: 'wrong'
      })
    ).toEqual({
      scopeId: 'metorial',
      slateId: 'apolloio'
    });
  });

  test('falls back to stored identifiers when full identifier is invalid', () => {
    expect(
      getRegistrySlatePathParams({
        slateFullIdentifierOnRegistry: 'invalid',
        slateScopeIdentifierOnRegistry: 'metorial',
        slateIdentifierOnRegistry: 'apolloio'
      })
    ).toEqual({
      scopeId: 'metorial',
      slateId: 'apolloio'
    });
  });
});
