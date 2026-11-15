import { describe, expect, it } from 'vitest';
import { getSamlConnectionDefaultRedirectUrl } from './ssoRedirect';

describe('getSamlConnectionDefaultRedirectUrl', () => {
  it('binds the Jackson default redirect to its tenant and connection', () => {
    let redirectUrl = new URL(
      getSamlConnectionDefaultRedirectUrl({
        callbackUrl: 'https://sso.example.com/sso/jxn/saml/callback',
        tenantId: 'tenant_123',
        connectionId: 'connection_123'
      })
    );

    expect(redirectUrl.pathname).toBe('/sso/jxn/saml/callback');
    expect(redirectUrl.searchParams.get('tenant_id')).toBe('tenant_123');
    expect(redirectUrl.searchParams.get('connection_id')).toBe('connection_123');
  });

  it('replaces untrusted existing tenant context', () => {
    let redirectUrl = new URL(
      getSamlConnectionDefaultRedirectUrl({
        callbackUrl:
          'https://sso.example.com/sso/jxn/saml/callback?tenant_id=attacker&connection_id=attacker',
        tenantId: 'tenant_123',
        connectionId: 'connection_123'
      })
    );

    expect(redirectUrl.searchParams.get('tenant_id')).toBe('tenant_123');
    expect(redirectUrl.searchParams.get('connection_id')).toBe('connection_123');
  });
});
