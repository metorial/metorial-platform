import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, userService, passwordService, emails, successfulLogin, device, captcha } =
  vi.hoisted(() => ({
    db: {
      user: { findFirst: vi.fn(), findUnique: vi.fn() },
      userPassword: { findUnique: vi.fn() },
      account: { findUnique: vi.fn() },
      accountDomain: { findUnique: vi.fn() },
      app: { findUnique: vi.fn() },
      ssoConnection: { findMany: vi.fn() },
      authDevice: { findUnique: vi.fn() },
      authIntent: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn()
      },
      authIntentStep: { create: vi.fn(), update: vi.fn() },
      authIntentCode: { create: vi.fn() },
      authAttempt: { create: vi.fn() }
    },
    userService: { findByEmailSafe: vi.fn(), linkToAccount: vi.fn() },
    passwordService: {
      canManagePassword: vi.fn(),
      verify: vi.fn(),
      assertVerifiedPassword: vi.fn()
    },
    emails: { send: vi.fn() },
    successfulLogin: { send: vi.fn() },
    device: { checkIfUserIsLoggedIn: vi.fn() },
    captcha: { enabled: false, verify: vi.fn() }
  }));

vi.mock('../db', () => ({ db, withTransaction: (fn: (db: unknown) => unknown) => fn(db) }));
vi.mock('../id', () => ({ getId: (name: string) => ({ oid: 20n, id: `${name}_1` }) }));
vi.mock('../lib/passwordLock', () => ({
  withUserPasswordLock: (_: string, fn: () => unknown) => fn()
}));
vi.mock('../lib/turnstile', () => ({ turnstileVerifier: captcha }));
vi.mock('../email/authCode', () => ({ sendAuthCodeEmail: emails }));
vi.mock('../email/successfulLogin', () => ({ successfulLoginVerification: successfulLogin }));
vi.mock('../lib/socials', () => ({ socials: {} }));
vi.mock('../queues/syncCallback', () => ({ markAresUserChanged: vi.fn() }));
vi.mock('./user', () => ({ userService }));
vi.mock('./userPassword', () => ({ userPasswordService: passwordService }));
vi.mock('./device', () => ({ deviceService: device }));
vi.mock('./auditLog', () => ({ auditLogService: { log: vi.fn() } }));
vi.mock('./authBlock', () => ({ authBlockService: { registerBlock: vi.fn() } }));
vi.mock('./accessGroup', () => ({
  accessGroupService: { checkAppAccess: vi.fn(async () => true) }
}));
vi.mock('./sso/domainPolicy', () => ({ ssoDomainPolicyService: {} }));
vi.mock('@lowerdeck/service', () => ({
  Service: { create: (_: string, factory: () => unknown) => ({ build: factory }) }
}));

import { authService } from './auth';

let app = { oid: 1n, id: 'app_1', disableEmailAuth: false } as any;
let user = {
  oid: 2n,
  id: 'user_1',
  appOid: app.oid,
  email: 'primary@example.com',
  status: 'active',
  signupMethod: 'email'
} as any;
let input = {
  app,
  email: 'alias@example.com',
  context: { ip: '127.0.0.1', ua: 'test' },
  redirectUrl: 'https://example.com/callback',
  device: { oid: 3n } as any
};
let intent: any;
let step: any;

beforeEach(() => {
  vi.clearAllMocks();
  captcha.enabled = false;
  db.accountDomain.findUnique.mockResolvedValue(null);
  db.account.findUnique.mockResolvedValue(null);
  db.ssoConnection.findMany.mockResolvedValue([]);
  db.app.findUnique.mockResolvedValue(app);
  db.user.findFirst.mockResolvedValue(null);
  db.user.findUnique.mockResolvedValue(user);
  userService.findByEmailSafe.mockResolvedValue(user);
  userService.linkToAccount.mockImplementation(async ({ user }) => user);
  device.checkIfUserIsLoggedIn.mockResolvedValue(false);
  passwordService.canManagePassword.mockResolvedValue(true);
  passwordService.verify.mockResolvedValue(undefined);
  passwordService.assertVerifiedPassword.mockResolvedValue(undefined);
  db.userPassword.findUnique.mockResolvedValue({ hash: 'never_exposed' });
  db.authIntent.create.mockImplementation(async ({ data }) => {
    intent = { ...data, steps: [], userIdentity: null, verifiedAt: null, consumedAt: null };
    return intent;
  });
  db.authIntent.findUnique.mockImplementation(async ({ where }) => {
    if (where.expiresAt && (intent.expiresAt <= new Date() || intent.consumedAt)) return null;
    return intent;
  });
  db.authIntent.update.mockImplementation(async ({ data }) => {
    Object.assign(intent, data);
    return intent;
  });
  db.authIntent.updateMany.mockResolvedValue({ count: 1 });
  db.authIntentStep.create.mockImplementation(async ({ data }) => {
    step = { ...data, verifiedAt: null, codes: [] };
    intent.steps = [step];
    return step;
  });
  db.authIntentStep.update.mockImplementation(async ({ data }) => {
    Object.assign(step, data);
    return step;
  });
  db.authIntentCode.create.mockImplementation(async ({ data }) => data);
  db.authDevice.findUnique.mockResolvedValue(input.device);
  db.authAttempt.create.mockImplementation(async ({ data }) => data);
});

describe('password-first Ares email flow', () => {
  it('creates a password challenge without sending an email, including verified aliases', async () => {
    let result = await authService.authWithEmail(input);
    expect(result.type).toBe('auth_intent');
    expect(intent).toMatchObject({
      type: 'password',
      userOid: user.oid,
      identifier: input.email
    });
    expect(step).toMatchObject({ type: 'password', email: input.email });
    expect(emails.send).not.toHaveBeenCalled();
    expect(userService.findByEmailSafe).toHaveBeenCalledWith({ email: input.email, app });
  });

  it.each(['signup', 'no_password', 'policy'])(
    'preserves the email-code flow for %s',
    async mode => {
      if (mode == 'signup') userService.findByEmailSafe.mockResolvedValue(null);
      if (mode == 'no_password') db.userPassword.findUnique.mockResolvedValue(null);
      if (mode == 'policy') passwordService.canManagePassword.mockResolvedValue(false);
      await authService.authWithEmail(input);
      expect(intent.type).toBe('email_code');
      expect(step.type).toBe('email_code');
      expect(emails.send).toHaveBeenCalledTimes(1);
    }
  );

  it('preserves the authenticated-device shortcut', async () => {
    device.checkIfUserIsLoggedIn.mockResolvedValue(true);
    let result = await authService.authWithEmail(input);
    expect(result.type).toBe('auth_attempt');
    expect(db.authIntent.create).not.toHaveBeenCalled();
    expect(emails.send).not.toHaveBeenCalled();
  });

  it('switches to email-code verification exactly once and leaves password limits behind', async () => {
    await authService.authWithEmail(input);
    passwordService.verify.mockRejectedValueOnce(new Error('Password attempts exceeded'));
    await expect(
      authService.verifyAuthIntentStep({
        step,
        input: { type: 'password', password: 'incorrect' }
      })
    ).rejects.toThrow('Password attempts exceeded');
    await authService.requestAuthIntentEmailCode({ authIntent: intent, step });
    await authService.requestAuthIntentEmailCode({ authIntent: intent, step });
    expect(intent.type).toBe('email_code');
    expect(step.type).toBe('email_code');
    expect(emails.send).toHaveBeenCalledTimes(1);
  });

  it('rejects expired or consumed fallback requests', async () => {
    await authService.authWithEmail(input);
    intent.expiresAt = new Date(0);
    await expect(
      authService.requestAuthIntentEmailCode({ authIntent: intent, step })
    ).rejects.toHaveProperty('data');
    expect(emails.send).not.toHaveBeenCalled();
  });

  it('completes through the existing attempt flow with the password method', async () => {
    await authService.authWithEmail(input);
    intent.verifiedAt = new Date();
    let result = await authService.completeAuthIntent({ authIntent: intent, app });
    expect(result.loginMethod).toBe('password');
    expect(successfulLogin.send).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ method: 'Password' }) })
    );
    expect(db.authIntent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          consumedAt: null,
          expiresAt: { gt: expect.any(Date) }
        })
      })
    );
    expect(db.authAttempt.create.mock.invocationCallOrder[0]).toBeLessThan(
      successfulLogin.send.mock.invocationCallOrder[0]!
    );
    expect(passwordService.assertVerifiedPassword).toHaveBeenCalledWith({
      userOid: user.oid,
      authIntentOid: intent.oid
    });
    expect(passwordService.assertVerifiedPassword.mock.invocationCallOrder[0]).toBeLessThan(
      db.authIntent.updateMany.mock.invocationCallOrder[0]!
    );
  });

  it('rejects a changed credential before consuming the intent or sending a success email', async () => {
    await authService.authWithEmail(input);
    intent.verifiedAt = new Date();
    passwordService.assertVerifiedPassword.mockRejectedValueOnce(
      new Error('Password replaced')
    );

    await expect(authService.completeAuthIntent({ authIntent: intent, app })).rejects.toThrow(
      'Password replaced'
    );
    expect(db.authIntent.updateMany).not.toHaveBeenCalled();
    expect(db.authAttempt.create).not.toHaveBeenCalled();
    expect(successfulLogin.send).not.toHaveBeenCalled();
  });

  it('rejects expired verified intents before creating an attempt or sending a success email', async () => {
    await authService.authWithEmail(input);
    intent.verifiedAt = new Date();
    intent.expiresAt = new Date(0);

    await expect(
      authService.completeAuthIntent({ authIntent: intent, app })
    ).rejects.toHaveProperty('data');
    expect(db.authAttempt.create).not.toHaveBeenCalled();
    expect(successfulLogin.send).not.toHaveBeenCalled();
  });

  it('does not send a success email when another completion has consumed the intent', async () => {
    await authService.authWithEmail(input);
    intent.verifiedAt = new Date();
    db.authIntent.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      authService.completeAuthIntent({ authIntent: intent, app })
    ).rejects.toHaveProperty('data');
    expect(db.authAttempt.create).not.toHaveBeenCalled();
    expect(successfulLogin.send).not.toHaveBeenCalled();
  });

  it('does not send a success email when attempt creation fails', async () => {
    await authService.authWithEmail(input);
    intent.verifiedAt = new Date();
    db.authAttempt.create.mockRejectedValueOnce(new Error('Attempt creation failed'));

    await expect(authService.completeAuthIntent({ authIntent: intent, app })).rejects.toThrow(
      'Attempt creation failed'
    );
    expect(successfulLogin.send).not.toHaveBeenCalled();
  });

  it('returns the completed attempt even if the success email cannot be delivered', async () => {
    await authService.authWithEmail(input);
    intent.verifiedAt = new Date();
    successfulLogin.send.mockRejectedValueOnce(new Error('Email delivery failed'));
    let log = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await expect(
        authService.completeAuthIntent({ authIntent: intent, app })
      ).resolves.toMatchObject({ loginMethod: 'password' });
      expect(log).toHaveBeenCalledWith('Unable to send the successful login email.');
    } finally {
      log.mockRestore();
    }
  });

  it('cannot create a new user from a password intent', async () => {
    await authService.authWithEmail(input);
    intent.verifiedAt = new Date();
    intent.userOid = null;
    await expect(
      authService.createUserForAuthIntent({
        authIntent: intent,
        app,
        input: { firstName: 'Test', lastName: 'User', acceptedTerms: true }
      })
    ).rejects.toHaveProperty('data');
  });
});
