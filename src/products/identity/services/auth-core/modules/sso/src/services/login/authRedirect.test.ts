import { describe, expect, it } from 'vitest';
import { getSsoAuthCompletionRedirect } from './authRedirect';

describe('SSO auth completion redirect', () => {
  it('returns connection tests with the test ID and preserves existing query parameters', () => {
    let result = getSsoAuthCompletionRedirect({
      redirectUri: 'https://dashboard.test/admin/auth?section=sso',
      purpose: 'connection_test',
      tenantId: 'tenant_123',
      authId: 'auth_123',
      testSsoId: 'test_123'
    });
    let url = new URL(result.url);

    expect(url.searchParams.get('section')).toBe('sso');
    expect(url.searchParams.get('test_sso_id')).toBe('test_123');
    expect(url.searchParams.has('tenant_id')).toBe(false);
    expect(url.searchParams.has('auth_id')).toBe(false);
  });

  it('never points a test at an SSO user, because a test does not create one', () => {
    let result = getSsoAuthCompletionRedirect({
      redirectUri: 'https://dashboard.test/admin/auth',
      purpose: 'connection_test',
      tenantId: 'tenant_123',
      authId: 'auth_123',
      testSsoId: 'test_123'
    });

    expect(new URL(result.url).searchParams.has('test_sso_user_id')).toBe(false);
  });

  it('keeps the existing tenant and auth callback contract for normal authentication', () => {
    let result = getSsoAuthCompletionRedirect({
      redirectUri: 'https://auth.test/complete',
      purpose: 'authentication',
      tenantId: 'tenant_123',
      authId: 'auth_123'
    });
    let url = new URL(result.url);

    expect(url.searchParams.get('tenant_id')).toBe('tenant_123');
    expect(url.searchParams.get('auth_id')).toBe('auth_123');
    expect(url.searchParams.has('test_sso_id')).toBe(false);
  });
});
