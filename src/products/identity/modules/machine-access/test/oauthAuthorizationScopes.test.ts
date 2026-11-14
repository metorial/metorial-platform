import { describe, expect, it, vi } from 'vitest';

let { getGrantedScopes } = vi.hoisted(() => ({
  getGrantedScopes: vi.fn()
}));

vi.mock('@metorial/module-organization/src/services/effectiveAccess', () => ({
  effectiveAccessService: {
    getMemberEffectiveAccess: vi.fn().mockResolvedValue({}),
    getGrantedScopes
  }
}));

import { consumerScopes, coreScopes } from '../../access/src/definitions';
import {
  cliAuthScopes,
  cliConsumerAuthScopes,
  getConsumerEffectiveScopes,
  getOAuthApplicationScopes,
  getUserEffectiveScopes
} from '../src/lib/oauthAuthorizationScopes';
import { validateOAuthScopes } from '../src/lib/oauthScopeValidation';

describe('oauthAuthorizationScopes', () => {
  it('grants the CLI app every core scope regardless of what is stored', () => {
    expect(cliAuthScopes).toEqual([...new Set(coreScopes)].sort());
    expect(cliAuthScopes).toContain('instance.sandbox:read');
    expect(getOAuthApplicationScopes({ type: 'cli_auth', scopes: [] })).toBe(cliAuthScopes);
  });

  it('uses the stored scopes for other application types', () => {
    expect(
      getOAuthApplicationScopes({ type: 'user_facing', scopes: ['instance.sandbox:read'] })
    ).toEqual(['instance.sandbox:read']);
  });

  it('still limits CLI tokens to what the member can access', async () => {
    getGrantedScopes.mockReturnValue(['instance.sandbox:read']);

    let scopes = await getUserEffectiveScopes({
      organization: { authVersion: 'v2' } as any,
      member: {} as any,
      oauthApplication: { type: 'cli_auth', scopes: [] } as any,
      requestedScopes: cliAuthScopes
    });

    expect(scopes).toEqual(['instance.sandbox:read']);
  });

  it('grants the CLI app every consumer scope for consumer subjects', () => {
    expect(cliConsumerAuthScopes).toEqual([...new Set(consumerScopes)].sort());
    expect(getOAuthApplicationScopes({ type: 'cli_auth', scopes: [] }, 'consumer')).toBe(
      cliConsumerAuthScopes
    );
  });

  it('validates scopes against the catalog of the subject', () => {
    expect(validateOAuthScopes(['consumer#instance:read'], 'consumer')).toEqual([
      'consumer#instance:read'
    ]);
    expect(() => validateOAuthScopes(['consumer#instance:read'])).toThrow();
    expect(() => validateOAuthScopes(['instance.sandbox:read'], 'consumer')).toThrow();
  });

  it('limits consumer scopes to the app, service account and request', () => {
    let scopes = getConsumerEffectiveScopes({
      oauthApplication: {
        type: 'server_side',
        scopes: ['consumer#instance:read', 'consumer#instance.file:read']
      },
      serviceAccount: { scopes: ['consumer#instance.file:read', 'consumer#instance:read'] },
      requestedScopes: ['consumer#instance.file:read', 'consumer#instance.store:read']
    });

    expect(scopes).toEqual(['consumer#instance.file:read']);
  });
});
