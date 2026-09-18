import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  authBlockService,
  db,
  deviceService,
  exchangeCodeForData,
  markAresUserChanged,
  sendAuthCodeEmail,
  userService
} = vi.hoisted(() => ({
  authBlockService: { registerBlock: vi.fn() },
  db: {
    accountDomain: { findUnique: vi.fn() },
    app: { findUnique: vi.fn() },
    appOAuthProvider: { findFirst: vi.fn() },
    authDevice: { findUnique: vi.fn() },
    authIntent: { create: vi.fn(), update: vi.fn() },
    authIntentCode: { create: vi.fn() },
    authIntentStep: { create: vi.fn() },
    ssoConnection: { findMany: vi.fn() },
    user: { findFirst: vi.fn(), findUnique: vi.fn() },
    userIdentity: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    userIdentityProvider: { findFirst: vi.fn() }
  },
  deviceService: { checkIfUserIsLoggedIn: vi.fn() },
  exchangeCodeForData: vi.fn(),
  markAresUserChanged: vi.fn(),
  sendAuthCodeEmail: { send: vi.fn() },
  userService: { findByEmailSafe: vi.fn(), linkToAccount: vi.fn() }
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
  sendAuthCodeEmail
}));

vi.mock('../email/successfulLogin', () => ({
  successfulLoginVerification: { send: vi.fn() }
}));

vi.mock('../lib/socials', () => ({
  socials: {
    google: { exchangeCodeForData },
    github: { exchangeCodeForData }
  }
}));

vi.mock('../queues/syncCallback', () => ({
  markAresUserChanged
}));

vi.mock('./accessGroup', () => ({ accessGroupService: {} }));
vi.mock('./auditLog', () => ({ auditLogService: { log: vi.fn() } }));
vi.mock('./authBlock', () => ({ authBlockService }));
vi.mock('./device', () => ({ deviceService }));
vi.mock('./sso/domainPolicy', () => ({ ssoDomainPolicyService: {} }));
vi.mock('./user', () => ({ userService }));

import { authService } from './auth';

describe('authService.authWithSocialProviderToken', () => {
  let app = { oid: 3n } as any;
  let user = { oid: 8n, id: 'usr_1', appOid: app.oid } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    db.appOAuthProvider.findFirst.mockResolvedValue({
      oid: 1n,
      clientId: 'client',
      clientSecret: 'secret',
      redirectUri: 'https://example.com/callback'
    });
    db.accountDomain.findUnique.mockResolvedValue(null);
    db.app.findUnique.mockResolvedValue({ ...app, disableEmailAuth: false });
    db.ssoConnection.findMany.mockResolvedValue([]);
    db.user.findFirst.mockResolvedValue(null);
    db.userIdentityProvider.findFirst.mockResolvedValue({ oid: 4n });
    db.userIdentity.findFirst.mockResolvedValue(null);
    db.userIdentity.create.mockResolvedValue({
      oid: 5n,
      id: 'uid_1',
      userOid: null,
      email: 'victim@example.com'
    });
    db.authIntent.create.mockImplementation(async ({ data }) => ({ ...data, oid: 6n }));
    db.authIntentStep.create.mockImplementation(async ({ data }) => ({ ...data, oid: 7n }));
    db.authIntentCode.create.mockImplementation(async ({ data }) => ({ ...data, oid: 9n }));
    userService.findByEmailSafe.mockResolvedValue(user);
  });

  it.each([false, undefined])(
    'requires an email code when provider verification state is %s',
    async emailVerified => {
      exchangeCodeForData.mockResolvedValue({
        id: 'attacker@provider.example',
        email: 'victim@example.com',
        emailVerified,
        name: 'Attacker',
        token: 'token',
        photoUrl: null
      });

      let result = await authService.authWithSocialProviderToken({
        code: 'code',
        provider: 'github',
        context: { ip: '1.2.3.4', ua: 'agent' },
        redirectUrl: 'https://example.com/callback',
        device: { oid: 2n } as any,
        app
      });

      expect(result).toMatchObject({
        type: 'auth_intent',
        authIntent: {
          type: 'oauth',
          userOid: user.oid,
          userIdentityOid: 5n,
          verifiedAt: null
        }
      });
      expect(db.userIdentity.update).not.toHaveBeenCalled();
      expect(userService.linkToAccount).not.toHaveBeenCalled();
      expect(deviceService.checkIfUserIsLoggedIn).not.toHaveBeenCalled();
      expect(authBlockService.registerBlock).toHaveBeenCalledWith({
        email: 'victim@example.com',
        context: { ip: '1.2.3.4', ua: 'agent' }
      });
      expect(db.authIntentStep.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          authIntentOid: 6n,
          type: 'email_code',
          email: 'victim@example.com'
        })
      });
      expect(sendAuthCodeEmail.send).toHaveBeenCalledWith({
        to: ['victim@example.com'],
        data: { code: expect.any(String) }
      });
    }
  );

  it('links the provider identity when the verified OAuth intent is completed', async () => {
    let authIntent = {
      oid: 6n,
      type: 'oauth',
      userOid: user.oid,
      userIdentityOid: 5n,
      deviceOid: 2n,
      accountOid: null,
      verifiedAt: new Date(),
      captchaVerifiedAt: new Date(),
      consumedAt: null,
      redirectUrl: 'https://example.com/callback',
      ip: '1.2.3.4',
      ua: 'agent',
      createdAt: new Date()
    } as any;
    db.user.findUnique.mockResolvedValue(user);
    db.authDevice.findUnique.mockResolvedValue({ oid: 2n });
    db.userIdentity.findUnique.mockResolvedValue({
      oid: 5n,
      userOid: null,
      provider: { name: 'Github' }
    });
    db.userIdentity.updateMany.mockResolvedValue({ count: 1 });
    let createAuthAttempt = vi
      .spyOn(authService, 'createAuthAttempt')
      .mockResolvedValue({ id: 'attempt_1' } as any);

    await expect(authService.completeAuthIntent({ authIntent, app })).resolves.toEqual({
      id: 'attempt_1'
    });

    expect(db.userIdentity.updateMany).toHaveBeenCalledWith({
      where: { oid: 5n, userOid: null },
      data: { userOid: user.oid }
    });
    expect(markAresUserChanged).toHaveBeenCalledWith({ userId: user.id, db });
    expect(createAuthAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ user, authIntent, loginMethod: 'oauth' })
    );
  });
});
