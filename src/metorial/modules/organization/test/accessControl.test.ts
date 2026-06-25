import { ServiceError } from '@lowerdeck/error';
import { describe, expect, it } from 'vitest';
import { normalizePolicyDocument, normalizeScopes } from '../src/lib/accessControl';

describe('accessControl', () => {
  describe('normalizeScopes', () => {
    it('rejects input scopes that are not in the available scope set', () => {
      expect(() => normalizeScopes(['organization:read', 'future.scope:read'])).toThrow(
        ServiceError
      );
    });

    it('still validates dependencies for input scopes', () => {
      expect(() => normalizeScopes(['organization:write'])).toThrow(
        /Missing scope dependencies: organization:read/
      );
    });
  });

  describe('normalizePolicyDocument', () => {
    it('validates scopes by default for input documents', () => {
      expect(() =>
        normalizePolicyDocument({
          access: [
            {
              target: 'org_123',
              scopes: ['organization:read', 'future.scope:read']
            }
          ]
        })
      ).toThrow(ServiceError);
    });

    it('accepts already stored scopes without checking this process scope set', () => {
      let document = normalizePolicyDocument(
        {
          access: [
            {
              target: 'org_123',
              scopes: ['organization:read', 'future.scope:read', 'future.scope:read']
            }
          ]
        },
        { validateScopes: false }
      );

      expect(document.access[0].scopes).toEqual(['organization:read', 'future.scope:read']);
    });
  });
});
