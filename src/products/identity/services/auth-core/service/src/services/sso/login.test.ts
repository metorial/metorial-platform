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

  it('logs into an account-enrolled delegated tenant with that account', async () => {
    let tenant = {
      oid: 10n,
      appOid: 1n,
      enrollment: 'account',
      accountOid: 50n,
      importedDelegationOid: 20n
    } as any;
    let account = { oid: 50n, appOid: 1n } as any;
    let connection = { id: 'connection_1', tenantOid: tenant.oid } as any;
    let userProfile = {
      oid: 30n,
      email: 'user@example.com',
      firstName: 'Test',
      lastName: 'User',
      uid: 'identity_1'
    } as any;
    let app = { oid: 1n, redirectDomains: ['app.example.com'] } as any;

    await ssoLoginService.completeLogin({
      tenant,
      connection,
      userProfile,
      app,
      account,
      device: { oid: 40n } as any,
      context: { ip: '1.2.3.4', ua: 'agent' },
      redirectUrl: 'https://app.example.com/callback'
    });

    expect(authWithSso).toHaveBeenCalledWith(expect.objectContaining({ account }));
  });

  it('rejects an account-enrolled tenant when the account is missing', async () => {
    await expect(
      ssoLoginService.completeLogin({
        tenant: {
          oid: 10n,
          appOid: 1n,
          enrollment: 'account',
          accountOid: 50n
        } as any,
        connection: { id: 'connection_1', tenantOid: 10n } as any,
        userProfile: {
          oid: 30n,
          email: 'user@example.com',
          firstName: 'Test',
          lastName: 'User',
          uid: 'identity_1'
        } as any,
        app: { oid: 1n, redirectDomains: [] } as any,
        device: { oid: 40n } as any,
        context: { ip: '1.2.3.4', ua: 'agent' },
        redirectUrl: 'https://app.example.com/callback'
      })
    ).rejects.toThrow('SSO tenant does not belong to this app');
  });
});
