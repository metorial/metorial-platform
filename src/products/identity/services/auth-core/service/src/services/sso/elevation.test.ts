import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, userService, authService, ssoAuthService, getSsoAuthStartUrl, auditLog } =
  vi.hoisted(() => ({
    db: {
      app: { findUniqueOrThrow: vi.fn() },
      userIdentityProvider: { findFirst: vi.fn(), create: vi.fn() },
      userIdentity: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() }
    },
    userService: { getUser: vi.fn() },
    authService: { getSsoConnections: vi.fn() },
    ssoAuthService: { createAuth: vi.fn(), completeAuth: vi.fn() },
    getSsoAuthStartUrl: vi.fn(),
    auditLog: { log: vi.fn() }
  }));

vi.mock('../../db', () => ({ db }));
vi.mock('../../id', () => ({ getId: (name: string) => ({ oid: 1n, id: `${name}_1` }) }));
vi.mock('../user', () => ({ userService }));
vi.mock('../auth', () => ({ authService }));
vi.mock('../auditLog', () => ({ auditLogService: auditLog }));
vi.mock('./auth', () => ({ ssoAuthService }));
vi.mock('./authStart', () => ({ getSsoAuthStartUrl }));

import { ssoElevationService } from './elevation';

let user = {
  oid: 5n,
  id: 'user_1',
  appOid: 1n,
  status: 'active',
  deletedAt: null,
  email: 'jane@acme.com',
  userEmails: [{ email: 'jane@acme.com', verifiedAt: new Date() }]
};
let app = { oid: 1n, redirectDomains: ['metorial.com', '*.metorial.com'] };
let tenant = { oid: 10n, id: 'tenant_1', appOid: 1n, name: 'Acme' };
let connection = {
  id: 'conn_1',
  name: 'Acme SAML',
  providerType: 'saml',
  providerName: null,
  sourceId: null,
  tenant
};
let account = { oid: 3n };
let context = { ip: '127.0.0.1', ua: 'test' };
let profile = {
  oid: 20n,
  uid: 'uid_1',
  email: 'jane@acme.com',
  firstName: 'Jane',
  lastName: 'Doe'
};

beforeEach(() => {
  vi.clearAllMocks();
  userService.getUser.mockResolvedValue(user);
  db.app.findUniqueOrThrow.mockResolvedValue(app);
  authService.getSsoConnections.mockResolvedValue({ account, connections: [connection] });
  db.userIdentityProvider.findFirst.mockResolvedValue({ oid: 30n });
  ssoAuthService.completeAuth.mockResolvedValue({
    tenant,
    connection,
    userProfile: profile
  });
});

describe('ssoElevationService.listOptions', () => {
  it('lists the connections the user would be offered at login', async () => {
    await expect(ssoElevationService.listOptions({ userId: 'user_1' })).resolves.toEqual([
      {
        tenantId: 'tenant_1',
        connectionId: 'conn_1',
        name: 'Acme SAML',
        providerType: 'saml',
        providerName: null
      }
    ]);
  });

  it('offers nothing when the user is not governed by an account', async () => {
    authService.getSsoConnections.mockResolvedValue({
      account: null,
      connections: [connection]
    });
    await expect(ssoElevationService.listOptions({ userId: 'user_1' })).resolves.toEqual([]);
  });
});

describe('ssoElevationService.create', () => {
  let input = {
    userId: 'user_1',
    tenantId: 'tenant_1',
    connectionId: 'conn_1',
    redirectUri: 'https://auth.metorial.com/elevation/sso/callback'
  };

  it('creates an elevation auth that forces a fresh login', async () => {
    ssoAuthService.createAuth.mockResolvedValue({ id: 'auth_1' });
    getSsoAuthStartUrl.mockResolvedValue('https://ares.example.com/sso/auth');

    await expect(ssoElevationService.create(input)).resolves.toEqual({
      authId: 'auth_1',
      url: 'https://ares.example.com/sso/auth'
    });
    expect(ssoAuthService.createAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          purpose: 'elevation',
          forceAuthn: true,
          email: 'jane@acme.com'
        })
      })
    );
  });

  it('rejects connections the user is not offered', async () => {
    await expect(
      ssoElevationService.create({ ...input, connectionId: 'other' })
    ).rejects.toThrow('not available');
    expect(ssoAuthService.createAuth).not.toHaveBeenCalled();
  });

  it('rejects redirect URIs outside the app domains', async () => {
    await expect(
      ssoElevationService.create({ ...input, redirectUri: 'https://evil.example.com/cb' })
    ).rejects.toThrow('Redirect URL domain not allowed');
  });
});

describe('ssoElevationService.complete', () => {
  let input = { userId: 'user_1', tenantId: 'tenant_1', authId: 'auth_1', context };

  it('only completes auths created for elevation', async () => {
    db.userIdentity.findFirst.mockResolvedValue({ oid: 40n, userOid: 5n });
    await ssoElevationService.complete(input);
    expect(ssoAuthService.completeAuth).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'elevation' })
    );
    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'elevation.sso' })
    );
  });

  it('rejects an identity linked to a different user', async () => {
    db.userIdentity.findFirst.mockResolvedValue({ oid: 40n, userOid: 99n });
    await expect(ssoElevationService.complete(input)).rejects.toMatchObject({
      data: { code: 'sso_elevation_identity_mismatch' }
    });
    expect(auditLog.log).not.toHaveBeenCalled();
  });

  it('links an unlinked identity only when the asserted email belongs to the user', async () => {
    db.userIdentity.findFirst.mockResolvedValue(null);
    await ssoElevationService.complete(input);
    expect(db.userIdentity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userOid: 5n }) })
    );

    db.userIdentity.create.mockClear();
    ssoAuthService.completeAuth.mockResolvedValue({
      tenant,
      connection,
      userProfile: { ...profile, email: 'someone.else@acme.com' }
    });
    await expect(ssoElevationService.complete(input)).rejects.toMatchObject({
      data: { code: 'sso_elevation_identity_mismatch' }
    });
    expect(db.userIdentity.create).not.toHaveBeenCalled();
  });
});
