import { generate, generateSecret } from 'otplib';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let { store, audit, webauthn } = vi.hoisted(() => ({
  store: {
    $queryRaw: vi.fn(),
    user: { findFirst: vi.fn(), update: vi.fn() },
    userTwoFactor: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn()
    },
    userRecoveryCode: {
      count: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn()
    },
    userTwoFactorSetup: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      create: vi.fn()
    },
    authDeviceUserSession: { findFirst: vi.fn() },
    authIntent: { findUnique: vi.fn(), update: vi.fn() },
    authIntentStep: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    authIntentVerificationAttempt: { count: vi.fn(), create: vi.fn() }
  },
  audit: vi.fn(),
  webauthn: { verifyAuthenticationResponse: vi.fn() }
}));

vi.mock('../db', () => ({
  db: store,
  withTransaction: (fn: (db: unknown) => unknown) => fn(store),
  addAfterTransactionHook: (fn: () => unknown) => fn()
}));
vi.mock('../env', () => ({
  env: {
    service: { ARES_AUTH_URL: 'https://id.example.com', TWO_FACTOR_SETUP_ENABLED: 'true' },
    keys: { TWO_FACTOR_ENCRYPTION_KEY: 'test-encryption-key' }
  }
}));
vi.mock('../id', () => ({
  getId: (type: string) => ({ oid: 100n, id: `${type}_1` }),
  ID: { generateId: async () => 'secret' }
}));
vi.mock('../lib/passwordLock', () => ({
  withUserPasswordLock: (_: string, fn: () => unknown) => fn()
}));
vi.mock('./auditLog', () => ({ auditLogService: { log: audit } }));
vi.mock('@lowerdeck/service', () => ({
  Service: { create: (_: string, fn: () => unknown) => ({ build: fn }) }
}));
vi.mock('@simplewebauthn/server', async original => ({
  ...(await original<typeof import('@simplewebauthn/server')>()),
  ...webauthn
}));

import { userTwoFactorService, verifyTotp } from './userTwoFactor';

let user = { oid: 1n, id: 'user', appOid: 2n, twoFactorRevision: 3 };

let step = { oid: 5n, id: 'second', type: 'two_factor', index: 1, verifiedAt: null };

let intent = {
  oid: 4n,
  id: 'intent',
  userOid: user.oid,
  appOid: user.appOid,
  user,
  type: 'password',
  twoFactorRevision: 3,
  verifiedAt: null,
  consumedAt: null,
  expiresAt: new Date(Date.now() + 600000),
  steps: [{ oid: 6n, id: 'first', type: 'password', index: 0, verifiedAt: new Date() }, step]
};

let proof = { userOid: user.oid, authIntentOid: intent.oid, loginMethod: 'password' };

let context = { ip: '127.0.0.1', ua: 'test' };

beforeEach(() => {
  vi.resetAllMocks();
  store.$queryRaw.mockResolvedValue([{ twoFactorRevision: 3 }]);
  store.user.findFirst.mockResolvedValue(user);
  store.userTwoFactor.count.mockResolvedValue(1);
  store.authIntent.findUnique.mockResolvedValue({
    ...intent,
    steps: intent.steps.map(value => ({ ...value }))
  });
  store.authIntentVerificationAttempt.count.mockResolvedValue(0);
  store.authIntentStep.findFirst.mockResolvedValue(null);
  store.userRecoveryCode.updateMany.mockResolvedValue({ count: 0 });
});

describe('login enforcement', () => {
  it.each(['oauth', 'sso'] as const)('does not challenge %s logins', async loginMethod => {
    await userTwoFactorService.assertVerified({ ...proof, loginMethod });
    expect(store.$queryRaw).not.toHaveBeenCalled();
  });

  it('allows reuse of an existing live session on the same device', async () => {
    store.authDeviceUserSession.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(
      userTwoFactorService.assertVerified({
        userOid: user.oid,
        authIntentOid: null,
        loginMethod: 'email',
        deviceOid: 7n,
        appOid: 2n
      })
    ).resolves.toBeUndefined();
  });

  it('rejects a session-reuse attempt when the original session is no longer active', async () => {
    store.authDeviceUserSession.findFirst.mockResolvedValue(null);
    await expect(
      userTwoFactorService.assertVerified({
        userOid: user.oid,
        authIntentOid: null,
        loginMethod: 'email',
        deviceOid: 7n,
        appOid: 2n
      })
    ).rejects.toThrow();
  });

  it('rejects attempts without a second-factor proof', async () => {
    await expect(userTwoFactorService.assertVerified(proof)).rejects.toMatchObject({
      data: { code: 'two_factor_invalid' }
    });
  });

  it('rejects proof from before a factor change', async () => {
    store.authIntent.findUnique.mockResolvedValue({
      ...intent,
      verifiedAt: new Date(),
      twoFactorRevision: 2,
      steps: [{ ...step, verifiedAt: new Date() }]
    });
    await expect(userTwoFactorService.assertVerified(proof)).rejects.toThrow();
  });

  it('accepts completed proof at the current factor revision', async () => {
    store.authIntent.findUnique.mockResolvedValue({
      ...intent,
      verifiedAt: new Date(),
      steps: [{ ...step, verifiedAt: new Date() }]
    });
    await expect(userTwoFactorService.assertVerified(proof)).resolves.toBeUndefined();
  });

  it('rejects a proof belonging to another user', async () => {
    store.authIntent.findUnique.mockResolvedValue({ ...intent, userOid: 99n });
    await expect(userTwoFactorService.assertVerified(proof)).rejects.toThrow();
  });

  it('appends the second step after primary verification', async () => {
    await expect(userTwoFactorService.afterPrimary(intent as never)).resolves.toBe(false);
    expect(store.authIntentStep.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'two_factor', index: 1 })
      })
    );
  });

  it('snapshots the revision even when no factors are enabled', async () => {
    store.userTwoFactor.count.mockResolvedValue(0);
    await expect(userTwoFactorService.afterPrimary(intent as never)).resolves.toBe(true);
    expect(store.authIntent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { twoFactorRevision: 3 } })
    );
    expect(store.authIntentStep.create).not.toHaveBeenCalled();
  });

  it('consumes a recovery code atomically before completing the intent', async () => {
    store.userRecoveryCode.updateMany.mockResolvedValue({ count: 1 });
    await userTwoFactorService.verifyLogin({
      authIntentId: 'intent',
      stepId: 'second',
      input: { type: 'recovery_code', code: 'ABCDE-FGHIJ' },
      context
    });
    expect(store.userRecoveryCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userOid: user.oid, consumedAt: null })
      })
    );
    expect(store.authIntent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { verifiedAt: expect.any(Date) } })
    );
  });

  it('records failed recovery attempts without completing login', async () => {
    await expect(
      userTwoFactorService.verifyLogin({
        authIntentId: 'intent',
        stepId: 'second',
        input: { type: 'recovery_code', code: 'USED-CODE' },
        context
      })
    ).rejects.toThrow();
    expect(store.authIntentVerificationAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failure', method: 'two_factor' })
      })
    );
    expect(store.authIntent.update).not.toHaveBeenCalled();
  });

  it('binds a passkey assertion to the challenge, canonical origin, RP, and user credential', async () => {
    store.authIntent.findUnique.mockResolvedValue({
      ...intent,
      steps: [
        intent.steps[0],
        { ...step, challenge: 'challenge', challengeExpiresAt: new Date(Date.now() + 60000) }
      ]
    });
    store.userTwoFactor.findFirst.mockResolvedValue({
      oid: 8n,
      credentialId: 'credential',
      publicKey: new Uint8Array([1]),
      counter: 0n
    });
    webauthn.verifyAuthenticationResponse.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 1 }
    });
    await userTwoFactorService.verifyLogin({
      authIntentId: 'intent',
      stepId: 'second',
      input: { type: 'passkey', response: { id: 'credential' } as never },
      context
    });
    expect(webauthn.verifyAuthenticationResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedChallenge: 'challenge',
        expectedOrigin: 'https://id.example.com',
        expectedRPID: 'id.example.com',
        requireUserVerification: true
      })
    );
    expect(store.userTwoFactor.findFirst).toHaveBeenCalledWith({
      where: { userOid: user.oid, credentialId: 'credential', method: 'passkey' }
    });
    expect(store.userTwoFactor.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ counter: 1n }) })
    );
  });

  it('consumes failed passkey challenges and records failures without completing login', async () => {
    store.authIntent.findUnique.mockResolvedValue({
      ...intent,
      steps: [
        intent.steps[0],
        { ...step, challenge: 'challenge', challengeExpiresAt: new Date(Date.now() + 60000) }
      ]
    });
    store.userTwoFactor.findFirst.mockResolvedValue({
      oid: 8n,
      credentialId: 'credential',
      publicKey: new Uint8Array([1]),
      counter: 0n
    });
    webauthn.verifyAuthenticationResponse.mockRejectedValue(new Error('Wrong origin'));
    await expect(
      userTwoFactorService.verifyLogin({
        authIntentId: 'intent',
        stepId: 'second',
        input: { type: 'passkey', response: { id: 'credential' } as never },
        context
      })
    ).rejects.toThrow();
    expect(store.authIntentStep.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { challenge: null, challengeExpiresAt: null } })
    );
    expect(store.authIntent.update).not.toHaveBeenCalled();
  });

  it('enforces the per-intent failure limit before checking credentials', async () => {
    store.authIntentVerificationAttempt.count.mockResolvedValue(10);
    await expect(
      userTwoFactorService.verifyLogin({
        authIntentId: 'intent',
        stepId: 'second',
        input: { type: 'recovery_code', code: 'CODE' },
        context
      })
    ).rejects.toMatchObject({ data: { code: 'two_factor_rate_limited' } });
    expect(store.userRecoveryCode.updateMany).not.toHaveBeenCalled();
  });

  it('enforces the user-wide failure limit across login intents', async () => {
    store.authIntentVerificationAttempt.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(30);
    await expect(
      userTwoFactorService.loginOptions({ authIntentId: 'intent', stepId: 'second' })
    ).rejects.toMatchObject({ data: { code: 'two_factor_rate_limited' } });
  });

  it('requires primary authentication before offering factor options', async () => {
    store.authIntent.findUnique.mockResolvedValue({
      ...intent,
      steps: [{ ...intent.steps[0], verifiedAt: null }, step]
    });
    await expect(
      userTwoFactorService.loginOptions({ authIntentId: 'intent', stepId: 'second' })
    ).rejects.toThrow();
  });
});

describe('TOTP verification', () => {
  it('accepts a current code and rejects reuse of its time step', async () => {
    let secret = generateSecret();
    let token = await generate({ secret });
    let result = await verifyTotp(secret, token);
    expect(result.valid).toBe(true);
    if (result.valid)
      expect((await verifyTotp(secret, token, result.timeStep)).valid).toBe(false);
  });

  it.each(['', '12345', 'abcdef', '1234567'])('rejects malformed code %s', async token => {
    expect((await verifyTotp(generateSecret(), token)).valid).toBe(false);
  });
});

describe('setup authorization', () => {
  it('requires a live Ares session linked to the same app and user', async () => {
    store.authDeviceUserSession.findFirst.mockResolvedValue(null);
    await expect(
      userTwoFactorService.startSetup({
        appId: 'app',
        userId: 'user',
        sessionId: 'session',
        method: 'totp',
        callbackUrl: 'https://auth.example.com/callback',
        returnUrl: 'https://platform.example.com/account',
        expiresAt: new Date(Date.now() + 60000),
        context
      })
    ).rejects.toThrow();
    expect(store.userTwoFactorSetup.create).not.toHaveBeenCalled();
  });

  it('stores a hashed setup capability and caps its expiry at the authorizing session', async () => {
    let expiresAt = new Date(Date.now() + 60000);
    store.authDeviceUserSession.findFirst.mockResolvedValue({ oid: 7n, expiresAt });
    store.userTwoFactorSetup.count.mockResolvedValue(0);
    store.userTwoFactorSetup.create.mockImplementation(async ({ data }) => data);
    let result = await userTwoFactorService.startSetup({
      appId: 'app',
      userId: 'user',
      sessionId: 'session',
      method: 'totp',
      callbackUrl: 'https://auth.example.com/callback',
      returnUrl: 'https://platform.example.com/account',
      expiresAt,
      context
    });
    let data = store.userTwoFactorSetup.create.mock.calls[0]![0].data;
    expect(data.secretHash).not.toBe('secret');
    expect(data.encryptedSecret).not.toContain('otpauth');
    expect(data.sessionOid).toBe(7n);
    expect(result.expiresAt).toEqual(expiresAt);
    expect(new URL(result.url).search).toBe('');
    expect(new URL(result.url).hash).toContain('client_secret=secret');
  });

  it('rejects invalid setup capabilities before exposing enrollment material', async () => {
    store.userTwoFactorSetup.findFirst.mockResolvedValue(null);
    await expect(
      userTwoFactorService.getSetup({
        setupId: 'setup',
        clientSecret: 'wrong',
        deviceId: 'other-device'
      })
    ).rejects.toThrow();
    expect(store.userTwoFactorSetup.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          session: expect.objectContaining({ device: { id: 'other-device' } }),
          secretHash: expect.any(String)
        })
      })
    );
  });

  it('rejects setup finalization after the factor revision changes', async () => {
    store.userTwoFactorSetup.findFirst.mockResolvedValue({ status: 'ready', revision: 2 });
    await expect(
      userTwoFactorService.finalize({
        appId: 'app',
        userId: 'user',
        setupId: 'setup',
        sessionId: 'session',
        context
      })
    ).rejects.toThrow();
    expect(store.userTwoFactor.create).not.toHaveBeenCalled();
  });

  it('does not duplicate factors when a completion is retried', async () => {
    store.userTwoFactorSetup.findFirst.mockResolvedValue({ status: 'completed' });
    await expect(
      userTwoFactorService.finalize({
        appId: 'app',
        userId: 'user',
        setupId: 'setup',
        sessionId: 'session',
        context
      })
    ).resolves.toEqual({ completed: true });
    expect(store.userTwoFactor.create).not.toHaveBeenCalled();
  });
});
