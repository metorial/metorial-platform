import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let { authLookup, userInfo, authUpdate, testUpdate, upsertUser, upsertProfile, saml, oidc } =
  vi.hoisted(() => ({
    authLookup: vi.fn(),
    userInfo: vi.fn(),
    authUpdate: vi.fn(),
    testUpdate: vi.fn(),
    upsertUser: vi.fn(),
    upsertProfile: vi.fn(),
    saml: vi.fn(),
    oidc: vi.fn()
  }));

vi.mock('@mtsrc/auth-core-db', () => ({
  db: {
    ssoAuth: { update: authUpdate, delete: vi.fn() },
    ssoTest: { findUnique: async () => ({ id: 'test', oid: 2n }), update: testUpdate },
    ssoConnection: { findUnique: async () => connection }
  }
}));

vi.mock('@mtsrc/auth-core-http', async () => ({
  ...(await import('@mtsrc/auth-core-http/src/pages/error')),
  ...(await import('@mtsrc/auth-core-http/src/pages/domain-not-allowed'))
}));

vi.mock('@mtsrc/auth-core-module-sso', async () => ({
  jackson: {
    oauthController: {
      userInfo,
      token: async () => ({ access_token: 'access-token' }),
      samlResponse: saml,
      oidcAuthzResponse: oidc
    }
  },
  ssoAuthService: { getAuthByClientSecret: authLookup },
  ssoIdentityService: { upsertUser, upsertUserProfile: upsertProfile },
  getSsoAuthCompletionRedirect: ({ redirectUri }: { redirectUri: string }) => ({
    url: redirectUri
  }),
  ...(await import('@mtsrc/auth-core-module-sso/src/services/identity/utils'))
}));

vi.mock('@mtsrc/auth-core-module-account', () => ({
  SsoDomainNotAllowedError: class extends Error {},
  ssoDomainPolicyService: { assertEmailAllowed: vi.fn() }
}));

vi.mock('@mtsrc/auth-core-api-auth/src/middleware/device', () => ({}));

vi.mock('@mtsrc/auth-core-module-session', () => ({ deviceService: {} }));

import { hashUid } from '@mtsrc/auth-core-module-sso';
import { ssoAuthApp } from './auth';
import { jxnApp } from './jxn';

let connection = {
  status: 'active',
  providerType: 'oidc',
  internalClientId: 'client-id',
  internalClientSecret: 'client-secret',
  oid: 1n
};

let start = (purpose: 'authentication' | 'connection_test') => {
  authLookup.mockResolvedValueOnce({
    oid: 1n,
    connectionOid: connection.oid,
    tenant: { id: 'tenant' },
    purpose,
    redirectUri: 'https://metorial.example.test/complete'
  });

  return ssoAuthApp.request('/callback?code=test&state=test');
};

describe('Auth Core SSO callback', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    upsertUser.mockResolvedValue({ oid: 3n });
    upsertProfile.mockResolvedValue({ oid: 4n });
  });

  afterEach(() => vi.restoreAllMocks());

  it('validates the same OIDC claims in a connection test and on first sign-in', async () => {
    userInfo.mockResolvedValue({
      id: 'subject',
      email: 'person@example.test',
      raw: { sub: 'subject', access_token: 'private' }
    });

    expect((await start('connection_test')).status).toBe(302);
    expect(upsertUser).not.toHaveBeenCalled();
    expect(upsertProfile).not.toHaveBeenCalled();
    expect(testUpdate.mock.calls[0]?.[0].data).toMatchObject({
      status: 'completed',
      uid: 'subject',
      raw: { sub: 'subject', access_token: '[Redacted]' }
    });

    expect((await start('authentication')).status).toBe(302);
    expect(upsertProfile.mock.calls[0]?.[0].data).toMatchObject({
      uid: 'subject',
      uidHash: hashUid('subject'),
      groups: [],
      roles: [],
      raw: { sub: 'subject', access_token: '[Redacted]' }
    });
    expect(authUpdate).toHaveBeenCalled();
  });

  it.each(['authentication', 'connection_test'] as const)(
    'rejects a profile missing its subject during %s',
    async purpose => {
      userInfo.mockResolvedValue({ email: 'person@example.test' });

      expect(await (await start(purpose)).text()).toContain('Unable to Authenticate');
      expect(testUpdate).not.toHaveBeenCalled();
      expect(upsertUser).not.toHaveBeenCalled();
    }
  );

  it('preserves legacy provider hashes when supplied', async () => {
    userInfo.mockResolvedValue({
      id: 'subject',
      idHash: 'legacy-hash',
      email: 'person@example.test'
    });

    expect((await start('authentication')).status).toBe(302);
    expect(upsertProfile.mock.calls[0]?.[0].data.uidHash).toBe('legacy-hash');
  });

  it('keeps provider callback diagnostics out of responses and logs', async () => {
    saml.mockResolvedValueOnce({ error: 'private SAML diagnostic' });
    oidc.mockRejectedValueOnce(new Error('private OIDC diagnostic'));

    let samlResponse = await jxnApp.request('/saml/callback', {
      method: 'POST',
      body: new URLSearchParams({
        SAMLResponse: 'private-assertion',
        RelayState: 'private-state'
      })
    });
    let oidcResponse = await jxnApp.request('/oidc/callback?code=private-code&state=test');

    expect(await samlResponse.text()).not.toContain('private');
    expect(await oidcResponse.text()).not.toContain('private');
    expect(vi.mocked(console.error).mock.calls).toEqual([
      ['SAML callback rejected by provider'],
      ['SSO provider callback failed']
    ]);
  });
});
