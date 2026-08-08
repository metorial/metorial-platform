import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let { authBlockService, db, deviceService, userService } = vi.hoisted(() => ({
  authBlockService: { registerBlock: vi.fn() },
  db: {
    accountDomain: { findUnique: vi.fn() },
    appOAuthProvider: { findMany: vi.fn() },
    ssoConnection: { findMany: vi.fn() },
    user: { findFirst: vi.fn() }
  },
  deviceService: { checkIfUserIsLoggedIn: vi.fn() },
  userService: { findByEmailSafe: vi.fn() }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name: string, factory: () => unknown) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('../db', () => ({
  db,
  withTransaction: async (cb: (tdb: unknown) => Promise<unknown>) => await cb(db)
}));

vi.mock('../email/authCode', () => ({
  sendAuthCodeEmail: { send: vi.fn() }
}));

vi.mock('../email/successfulLogin', () => ({
  successfulLoginVerification: { send: vi.fn() }
}));

vi.mock('../queues/syncCallback', () => ({
  markAresUserChanged: vi.fn()
}));

vi.mock('./accessGroup', () => ({
  accessGroupService: {}
}));

vi.mock('./auditLog', () => ({
  auditLogService: { log: vi.fn() }
}));

vi.mock('./authBlock', () => ({
  authBlockService
}));

vi.mock('./device', () => ({
  deviceService
}));

vi.mock('./sso/domainPolicy', () => ({
  ssoDomainPolicyService: {}
}));

vi.mock('./user', () => ({
  userService
}));

import { authService } from './auth';

afterEach(() => {
  vi.restoreAllMocks();
});

let app = {
  oid: 1n,
  disableEmailAuth: false
} as any;

let account = {
  oid: 2n,
  id: 'account_1',
  appOid: app.oid,
  status: 'active'
} as any;

let localConnection = {
  oid: 3n,
  id: 'connection_1',
  tenantOid: 4n,
  tenant: {
    oid: 4n,
    id: 'tenant_1',
    name: 'Acme',
    importedDelegationOid: null
  },
  name: 'Employees'
} as any;

describe('authService.getUserAuthOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.accountDomain.findUnique.mockResolvedValue({
      accountOid: account.oid,
      account,
      allowedTenants: [],
      allowedConnections: []
    });
    db.ssoConnection.findMany.mockResolvedValue([localConnection]);
    db.user.findFirst.mockResolvedValue(null);
    authBlockService.registerBlock.mockResolvedValue(undefined);
    deviceService.checkIfUserIsLoggedIn.mockResolvedValue(false);
    db.appOAuthProvider.findMany.mockResolvedValue([
      { provider: 'google' },
      { provider: 'github' }
    ]);
    userService.findByEmailSafe.mockResolvedValue(null);
  });

  it('offers email and SSO, but not OAuth, to an email-origin user on an SSO domain', async () => {
    userService.findByEmailSafe.mockResolvedValue({
      status: 'active',
      signupMethod: 'email'
    });

    await expect(
      authService.getUserAuthOptions({ app, email: 'user@acme.com' })
    ).resolves.toEqual({
      account,
      options: [
        { type: 'email' },
        {
          type: 'sso',
          tenantId: 'tenant_1',
          tenantName: 'Acme',
          connectionId: 'connection_1',
          connectionName: 'Employees'
        }
      ]
    });
  });

  it('honors an account policy that disables email login', async () => {
    db.accountDomain.findUnique.mockResolvedValue({
      accountOid: account.oid,
      account: { ...account, allowEmailLogin: false },
      allowedTenants: [],
      allowedConnections: []
    });
    userService.findByEmailSafe.mockResolvedValue({
      status: 'active',
      signupMethod: 'email'
    });

    let result = await authService.getUserAuthOptions({
      app,
      email: 'user@acme.com'
    });

    expect(result.options).toEqual([
      expect.objectContaining({ type: 'sso', connectionId: 'connection_1' })
    ]);
  });

  it.each([
    null,
    { status: 'active', signupMethod: 'sso' },
    { status: 'active', signupMethod: 'oauth' },
    { status: 'deleted', signupMethod: 'email' }
  ])('offers only SSO when email login is not available to the user', async user => {
    userService.findByEmailSafe.mockResolvedValue(user);

    let result = await authService.getUserAuthOptions({
      app,
      email: 'user@acme.com'
    });

    expect(result.options).toEqual([
      expect.objectContaining({ type: 'sso', connectionId: 'connection_1' })
    ]);
  });

  it('treats a delegated connection like local SSO', async () => {
    db.ssoConnection.findMany.mockResolvedValue([
      {
        ...localConnection,
        importedDelegationOid: 5n,
        tenant: { ...localConnection.tenant, importedDelegationOid: 5n }
      }
    ]);

    let result = await authService.getUserAuthOptions({
      app,
      email: 'user@acme.com'
    });

    expect(result.options).toEqual([
      expect.objectContaining({ type: 'sso', connectionId: 'connection_1' })
    ]);
  });

  it('returns the default methods when the domain has no SSO connection', async () => {
    db.accountDomain.findUnique.mockResolvedValue(null);
    db.ssoConnection.findMany.mockResolvedValue([]);

    await expect(
      authService.getUserAuthOptions({ app, email: 'user@example.com' })
    ).resolves.toEqual({
      account: null,
      options: [
        { type: 'email' },
        { type: 'oauth', provider: 'google' },
        { type: 'oauth', provider: 'github' }
      ]
    });
    expect(userService.findByEmailSafe).not.toHaveBeenCalled();
  });

  it('keeps the default layout for app-level SSO not owned by the email domain', async () => {
    db.accountDomain.findUnique.mockResolvedValue(null);

    let result = await authService.getUserAuthOptions({
      app,
      email: 'user@example.com'
    });

    expect(result.options).toEqual([
      expect.objectContaining({ type: 'sso', connectionId: 'connection_1' }),
      { type: 'email' },
      { type: 'oauth', provider: 'google' },
      { type: 'oauth', provider: 'github' }
    ]);
    expect(userService.findByEmailSafe).not.toHaveBeenCalled();
  });
});

describe('authService.authWithEmail on an SSO domain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.accountDomain.findUnique.mockResolvedValue({
      accountOid: account.oid,
      account,
      allowedTenants: [],
      allowedConnections: []
    });
    db.ssoConnection.findMany.mockResolvedValue([localConnection]);
    authBlockService.registerBlock.mockResolvedValue(undefined);
  });

  it('continues with email for an existing email-origin user', async () => {
    let user = { oid: 8n, status: 'active', signupMethod: 'email' };
    userService.findByEmailSafe.mockResolvedValue(user);
    deviceService.checkIfUserIsLoggedIn.mockResolvedValue(true);
    let createAuthAttempt = vi
      .spyOn(authService, 'createAuthAttempt')
      .mockResolvedValue({ id: 'attempt_1' } as any);

    let result = await authService.authWithEmail({
      app,
      device: { oid: 9n } as any,
      context: { ip: '1.2.3.4', ua: 'agent' },
      email: 'user@acme.com',
      redirectUrl: 'https://app.example.com/callback'
    });

    expect(result).toEqual({
      type: 'auth_attempt',
      authAttempt: { id: 'attempt_1' }
    });
    expect(createAuthAttempt).toHaveBeenCalledWith(expect.objectContaining({ user, account }));
  });

  it('keeps routing unknown users through SSO', async () => {
    userService.findByEmailSafe.mockResolvedValue(null);

    let result = await authService.authWithEmail({
      app,
      device: { oid: 9n } as any,
      context: { ip: '1.2.3.4', ua: 'agent' },
      email: 'unknown@acme.com',
      redirectUrl: 'https://app.example.com/callback'
    });

    expect(result).toEqual(
      expect.objectContaining({
        type: 'hook',
        authType: 'sso',
        ssoConnection: localConnection
      })
    );
    expect(authBlockService.registerBlock).not.toHaveBeenCalled();
  });

  it('keeps routing email-origin users through SSO when account email login is disabled', async () => {
    db.accountDomain.findUnique.mockResolvedValue({
      accountOid: account.oid,
      account: { ...account, allowEmailLogin: false },
      allowedTenants: [],
      allowedConnections: []
    });
    userService.findByEmailSafe.mockResolvedValue({
      oid: 8n,
      status: 'active',
      signupMethod: 'email'
    });

    let result = await authService.authWithEmail({
      app,
      device: { oid: 9n } as any,
      context: { ip: '1.2.3.4', ua: 'agent' },
      email: 'user@acme.com',
      redirectUrl: 'https://app.example.com/callback'
    });

    expect(result).toEqual(expect.objectContaining({ type: 'hook', authType: 'sso' }));
    expect(authBlockService.registerBlock).not.toHaveBeenCalled();
  });
});
