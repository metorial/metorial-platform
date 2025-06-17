import { describe, expect, it } from 'vitest';
import {
  instancePublishableTokenScopes,
  instanceSecretTokenScopes,
  orgManagementTokenScopes,
  Scope,
  scopes
} from '../src/definitions';

describe('definitions', () => {
  it('orgManagementTokenScopes should not include user:read or user:write', () => {
    expect(orgManagementTokenScopes).not.toContain('user:read');
    expect(orgManagementTokenScopes).not.toContain('user:write');
    // Should include all other scopes
    for (const s of scopes) {
      if (s !== 'user:read' && s !== 'user:write') {
        expect(orgManagementTokenScopes).toContain(s);
      }
    }
  });

  it('instanceSecretTokenScopes should be a subset of scopes', () => {
    for (const s of instanceSecretTokenScopes) {
      expect(scopes).toContain(s);
    }
  });

  it('instanceSecretTokenScopes should only contain instance.* scopes', () => {
    for (const s of instanceSecretTokenScopes) {
      expect(s.startsWith('instance.')).toBe(true);
    }
  });

  it('instancePublishableTokenScopes should only contain instance.server_listing:read', () => {
    expect(instancePublishableTokenScopes).toEqual(['instance.server_listing:read']);
  });

  it('Scope type should match all values in scopes', () => {
    // Type test: this will fail to compile if types are wrong
    const test: Scope[] = scopes;
    expect(test).toBe(scopes);
  });
});
