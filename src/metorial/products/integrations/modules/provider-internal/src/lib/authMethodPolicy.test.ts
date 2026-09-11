import { describe, expect, it } from 'vitest';
import {
  assertAuthMethodAllowedForTenant,
  isAuthMethodAllowedForTenant
} from './authMethodPolicy';

let oauthMethod = { type: 'oauth' as const };
let tokenMethod = { type: 'token' as const };

describe('auth method policy', () => {
  it('keeps all auth methods available when the policy is disabled', () => {
    expect(
      isAuthMethodAllowedForTenant({ onlyAllowOAuthAuthMethods: false }, tokenMethod as any)
    ).toBe(true);
  });

  it('allows OAuth and no-auth providers when the policy is enabled', () => {
    let tenant = { onlyAllowOAuthAuthMethods: true };

    expect(isAuthMethodAllowedForTenant(tenant, oauthMethod as any)).toBe(true);
    expect(isAuthMethodAllowedForTenant(tenant, null)).toBe(true);
  });

  it('rejects non-OAuth and missing required auth methods', () => {
    let tenant = { onlyAllowOAuthAuthMethods: true };

    expect(isAuthMethodAllowedForTenant(tenant, tokenMethod as any)).toBe(false);
    expect(isAuthMethodAllowedForTenant(tenant, null, true)).toBe(false);
    expect(() =>
      assertAuthMethodAllowedForTenant({
        tenant,
        authMethod: tokenMethod as any
      })
    ).toThrow('This project only allows OAuth authentication methods');
  });
});
