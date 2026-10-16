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

import { coreScopes } from '../../access/src/definitions';
import {
  cliAuthScopes,
  getOAuthApplicationScopes,
  getUserEffectiveScopes
} from '../src/lib/oauthAuthorizationScopes';

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
});
