import { beforeEach, describe, expect, it, vi } from 'vitest';

let { authWithSso, exchangeAuthAttemptForSession } = vi.hoisted(() => ({
  authWithSso: vi.fn(),
  exchangeAuthAttemptForSession: vi.fn()
}));

vi.mock('../auth', () => ({
  authService: { authWithSso }
}));

vi.mock('../device', () => ({
  deviceService: { exchangeAuthAttemptForSession }
}));

import { ssoLoginService } from './login';

describe('ssoLoginService.completeLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authWithSso.mockResolvedValue({ redirectUrl: 'https://app.example.com/callback' });
    exchangeAuthAttemptForSession.mockResolvedValue({ id: 'session_1' });
  });

  it.each([
    ['local', { importedDelegationOid: null }],
    ['delegated', { importedDelegationOid: 20n }]
  ])('uses the shared SSO authentication flow for a %s connection', async (_, connectionFields) => {
    let tenant = {
      oid: 10n,
      appOid: 1n,
      enrollment: 'disabled',
      accountOid: null,
      ...connectionFields
    } as any;
    let connection = {
      id: 'connection_1',
      tenantOid: tenant.oid,
      ...connectionFields
    } as any;
    let userProfile = {
      oid: 30n,
      email: 'user@example.com',
      firstName: 'Test',
      lastName: 'User',
      uid: 'identity_1'
    } as any;
    let app = {
      oid: 1n,
      redirectDomains: ['app.example.com']
    } as any;
    let device = { oid: 40n } as any;
    let context = { ip: '1.2.3.4', ua: 'agent' };

    await ssoLoginService.completeLogin({
      tenant,
      connection,
      userProfile,
      app,
      device,
      context,
      redirectUrl: 'https://app.example.com/callback'
    });

    expect(authWithSso).toHaveBeenCalledWith(
      expect.objectContaining({
        ssoTenant: tenant,
        ssoUserProfile: userProfile,
        ssoConnectionId: connection.id,
        ssoUid: userProfile.uid
      })
    );
  });
});
