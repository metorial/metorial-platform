import { execFileSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let { db, password, captcha, audit, transaction } = vi.hoisted(() => ({
  db: {
    user: { findFirst: vi.fn(), findUnique: vi.fn() },
    app: { findUnique: vi.fn() },
    account: { findUnique: vi.fn() },
    userIdentity: { findFirst: vi.fn() },
    userPassword: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    authIntent: { findUnique: vi.fn(), update: vi.fn() },
    authIntentStep: { findUnique: vi.fn(), update: vi.fn() },
    authIntentVerificationAttempt: { count: vi.fn(), create: vi.fn() },
    $queryRaw: vi.fn()
  },
  password: { hash: vi.fn(), verify: vi.fn() },
  captcha: { enabled: false },
  audit: { log: vi.fn() },
  transaction: { current: null as any, override: null as any }
}));

vi.mock('../db', () => ({
  db,
  withTransaction: async (fn: (db: unknown) => unknown, opts?: { ifExists?: boolean }) => {
    if (transaction.current || opts?.ifExists) return fn(transaction.current ?? db);

    transaction.current = transaction.override ?? db;
    try {
      return await fn(transaction.current);
    } finally {
      transaction.current = null;
    }
  }
}));
vi.mock('../id', () => ({ getId: (name: string) => ({ oid: 100n, id: `${name}_1` }) }));
vi.mock('../lib/passwordLock', () => ({
  withUserPasswordLock: (_: string, fn: () => unknown) => fn()
}));
vi.mock('../lib/turnstile', () => ({ turnstileVerifier: captcha }));
vi.mock('./auditLog', () => ({ auditLogService: audit }));
vi.mock('@lowerdeck/service', () => ({
  Service: { create: (_: string, factory: () => unknown) => ({ build: factory }) }
}));

import { isValidPassword, isValidPasswordLength, userPasswordService } from './userPassword';

let user = {
  id: 'user_1',
  oid: 1n,
  appOid: 2n,
  accountOid: null,
  owner: 'self',
  status: 'active',
  type: 'user',
  isFullyCreated: true
} as any;
let step = { oid: 3n, id: 'step_1', index: 0, type: 'password', verifiedAt: null };
let intent: any;
let context = { ip: '127.0.0.1', ua: 'test' };

beforeEach(() => {
  vi.clearAllMocks();
  transaction.current = null;
  transaction.override = null;
  vi.stubGlobal('Bun', { password });
  captcha.enabled = false;
  intent = {
    id: 'intent_1',
    oid: 4n,
    appOid: user.appOid,
    userOid: user.oid,
    user,
    type: 'password',
    consumedAt: null,
    verifiedAt: null,
    captchaVerifiedAt: null,
    expiresAt: new Date(Date.now() + 600000),
    steps: [step]
  };
  db.user.findFirst.mockResolvedValue(user);
  db.user.findUnique.mockResolvedValue(user);
  db.app.findUnique.mockResolvedValue({ disableEmailAuth: false });
  db.account.findUnique.mockResolvedValue(null);
  db.userIdentity.findFirst.mockResolvedValue(null);
  db.userPassword.findUnique.mockResolvedValue({
    hash: 'hash_1',
    version: 'version_1',
    updatedAt: new Date(0)
  });
  db.$queryRaw.mockResolvedValue([{ version: 'version_1' }]);
  db.userPassword.upsert.mockResolvedValue({ updatedAt: new Date(1000) });
  db.userPassword.deleteMany.mockResolvedValue({ count: 1 });
  db.authIntent.findUnique.mockImplementation(async () => intent);
  db.authIntentStep.findUnique.mockResolvedValue(step);
  db.authIntentVerificationAttempt.count.mockResolvedValue(0);
  password.hash.mockResolvedValue('encoded_hash');
  password.verify.mockResolvedValue(true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Ares optional passwords', () => {
  it('hashes passwords with explicit Argon2id costs and returns only status', async () => {
    let result = await userPasswordService.set({
      appId: 'app_1',
      userId: user.id,
      password: ' A long passphrase 1! ',
      context
    });
    expect(password.hash).toHaveBeenCalledWith(' A long passphrase 1! ', {
      algorithm: 'argon2id',
      memoryCost: 65536,
      timeCost: 2
    });
    expect(db.userPassword.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ userOid: user.oid, hash: 'encoded_hash' }),
        update: { hash: 'encoded_hash', version: expect.any(String) }
      })
    );
    expect(result).toEqual({
      hasPassword: true,
      canManagePassword: true,
      updatedAt: new Date(1000)
    });
    expect(audit.log.mock.calls[0]![0]).not.toHaveProperty('password');
    expect(audit.log.mock.calls[0]![0]).not.toHaveProperty('hash');
  });

  it('counts Unicode code points without trimming spaces', () => {
    expect(isValidPasswordLength('😀'.repeat(12))).toBe(true);
    expect(isValidPasswordLength(' '.repeat(12))).toBe(true);
    expect(isValidPasswordLength('a'.repeat(11))).toBe(false);
    expect(isValidPasswordLength('😀'.repeat(128))).toBe(true);
    expect(isValidPasswordLength('a'.repeat(129))).toBe(false);
  });

  it.each([
    'abcdefghijk1!',
    'ABCDEFGHIJK1!',
    'Abcdefghijk!',
    'Abcdefghijk1',
    'Abcdefghi 1 ',
    'ShortA1!'
  ])(
    'rejects a password missing a required character class or minimum length: %s',
    async value => {
      expect(isValidPassword(value)).toBe(false);
      await expect(
        userPasswordService.set({ appId: 'app_1', userId: user.id, password: value, context })
      ).rejects.toMatchObject({ data: { code: 'bad_request' } });
      expect(password.hash).not.toHaveBeenCalled();
    }
  );

  it('accepts all required character classes with Unicode letters and digits', () => {
    expect(isValidPassword('StrongPass1!')).toBe(true);
    expect(isValidPassword('Äbcdefghij1!')).toBe(true);
    expect(isValidPassword('StrongPass١!')).toBe(true);
    expect(isValidPassword('StrongPass1 ')).toBe(false);
  });

  it('supports adding, changing, and removing the single credential', async () => {
    db.userPassword.findUnique.mockResolvedValueOnce(null);
    await userPasswordService.set({
      appId: 'app_1',
      userId: user.id,
      password: 'My passphrase 1!',
      context
    });
    expect(audit.log).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'user.password.set' })
    );
    await userPasswordService.set({
      appId: 'app_1',
      userId: user.id,
      password: 'My new passphrase 2!',
      context
    });
    expect(audit.log).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'user.password.changed' })
    );
    await expect(
      userPasswordService.remove({ appId: 'app_1', userId: user.id, context })
    ).resolves.toMatchObject({ hasPassword: false });
    expect(db.userPassword.deleteMany).toHaveBeenCalledWith({ where: { userOid: user.oid } });
  });

  it.each([
    { owner: 'tenant' },
    { type: 'system' },
    { status: 'deleted' },
    { isFullyCreated: false }
  ])('rejects managed or inactive users: %j', async fields => {
    expect(await userPasswordService.canManagePassword({ ...user, ...fields })).toBe(false);
  });

  it('honors app, account, and SSO restrictions', async () => {
    db.app.findUnique.mockResolvedValueOnce({ disableEmailAuth: true });
    expect(await userPasswordService.canManagePassword(user)).toBe(false);
    db.userIdentity.findFirst.mockResolvedValueOnce({ ssoUserProfileOid: 20n });
    expect(await userPasswordService.canManagePassword(user)).toBe(false);
    db.account.findUnique.mockResolvedValueOnce({ status: 'active', allowEmailLogin: false });
    expect(await userPasswordService.canManagePassword({ ...user, accountOid: 10n })).toBe(
      false
    );
  });

  it('enforces app scope and never hashes a forbidden password', async () => {
    db.user.findFirst.mockResolvedValueOnce(null);
    await expect(
      userPasswordService.set({
        appId: 'wrong_app',
        userId: user.id,
        password: 'My passphrase 1!',
        context
      })
    ).rejects.toMatchObject({ data: { code: 'not_found' } });
    expect(password.hash).not.toHaveBeenCalled();
  });

  it('verifies the current credential and marks the intent verified', async () => {
    await userPasswordService.verify({
      authIntentId: intent.id,
      stepId: step.id,
      password: 'My passphrase 1!'
    });
    expect(password.verify).toHaveBeenCalledWith('My passphrase 1!', 'hash_1');
    expect(db.authIntentVerificationAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'success', method: 'password' })
      })
    );
    expect(db.authIntent.update).toHaveBeenCalled();
  });

  it('grants 30 minutes to complete a password intent verified just before expiry', async () => {
    vi.useFakeTimers();
    let verifiedAt = new Date('2026-10-12T12:00:00.000Z');
    vi.setSystemTime(verifiedAt);
    intent.expiresAt = new Date(verifiedAt.getTime() + 1000);
    db.authIntent.update.mockImplementationOnce(async ({ data }) => {
      Object.assign(intent, data);
      return intent;
    });

    await userPasswordService.verify({
      authIntentId: intent.id,
      stepId: step.id,
      password: 'My passphrase 1!'
    });
    vi.advanceTimersByTime(2000);

    expect(intent.verifiedAt).toEqual(verifiedAt);
    expect(intent.passwordVersion).toBe('version_1');
    expect(intent.expiresAt).toEqual(new Date(verifiedAt.getTime() + 30 * 60 * 1000));
    expect(intent.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(db.authIntentStep.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { verifiedAt } })
    );
  });

  it('reuses the verification transaction for policy lookups without acquiring another connection', async () => {
    let appLookup = vi.fn(async () => ({ disableEmailAuth: false }));
    transaction.override = { ...db, app: { findUnique: appLookup } };
    db.app.findUnique.mockImplementationOnce(async () => {
      if (transaction.current)
        throw new Error('The only connection is already held by the transaction');
      return { disableEmailAuth: false };
    });

    await userPasswordService.verify({
      authIntentId: intent.id,
      stepId: step.id,
      password: 'My passphrase 1!'
    });

    expect(db.app.findUnique).toHaveBeenCalledTimes(1);
    expect(appLookup).toHaveBeenCalledTimes(1);
    expect(db.authIntent.update).toHaveBeenCalled();
  });

  it('accepts the credential revision that verified the intent and locks it until completion', async () => {
    intent.verifiedAt = new Date();
    intent.passwordVersion = 'version_1';

    await expect(
      userPasswordService.assertVerifiedPassword({
        userOid: user.oid,
        authIntentOid: intent.oid
      })
    ).resolves.toBeUndefined();
    expect(db.$queryRaw.mock.calls[0]![0].join('')).toContain('FOR UPDATE');
    expect(db.$queryRaw.mock.calls[0]![1]).toBe(user.oid);
  });

  it.each(['removed', 'replaced', 'unbound', 'wrong_user', 'wrong_app', 'managed'])(
    'rejects %s credentials at completion',
    async state => {
      intent.verifiedAt = new Date();
      intent.passwordVersion = 'version_1';
      if (state == 'removed') db.$queryRaw.mockResolvedValueOnce([]);
      if (state == 'replaced') db.$queryRaw.mockResolvedValueOnce([{ version: 'version_2' }]);
      if (state == 'unbound') intent.passwordVersion = null;
      if (state == 'wrong_user') intent.userOid = 999n;
      if (state == 'wrong_app') intent.appOid = 999n;
      if (state == 'managed')
        db.user.findUnique.mockResolvedValueOnce({ ...user, owner: 'tenant' });

      await expect(
        userPasswordService.assertVerifiedPassword({
          userOid: user.oid,
          authIntentOid: intent.oid
        })
      ).rejects.toMatchObject({ data: { code: 'forbidden' } });
    }
  );

  it('does not extend an intent that expires while the password is being checked', async () => {
    vi.useFakeTimers();
    intent.expiresAt = new Date(Date.now() + 1000);
    password.verify.mockImplementationOnce(async () => {
      vi.advanceTimersByTime(1000);
      return true;
    });

    await expect(
      userPasswordService.verify({
        authIntentId: intent.id,
        stepId: step.id,
        password: 'My passphrase 1!'
      })
    ).rejects.toMatchObject({ data: { code: 'forbidden' } });
    expect(db.authIntent.update).not.toHaveBeenCalled();
  });

  it('records failures without verifying the intent', async () => {
    password.verify.mockResolvedValue(false);
    await expect(
      userPasswordService.verify({
        authIntentId: intent.id,
        stepId: step.id,
        password: 'incorrect'
      })
    ).rejects.toMatchObject({ data: { code: 'bad_request' } });
    expect(db.authIntentVerificationAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failure' }) })
    );
    expect(db.authIntent.update).not.toHaveBeenCalled();
  });

  it('rejects a credential replaced while verification is in progress', async () => {
    db.userPassword.findUnique
      .mockResolvedValueOnce({ hash: 'hash_1' })
      .mockResolvedValueOnce({ hash: 'replacement_hash' });
    await expect(
      userPasswordService.verify({
        authIntentId: intent.id,
        stepId: step.id,
        password: 'My passphrase 1!'
      })
    ).rejects.toMatchObject({ data: { code: 'forbidden' } });
    expect(db.authIntent.update).not.toHaveBeenCalled();
  });

  it('rechecks user eligibility before committing verification', async () => {
    db.user.findUnique.mockResolvedValueOnce({ ...user, status: 'deleted' });
    await expect(
      userPasswordService.verify({
        authIntentId: intent.id,
        stepId: step.id,
        password: 'My passphrase 1!'
      })
    ).rejects.toMatchObject({ data: { code: 'forbidden' } });
    expect(db.authIntentVerificationAttempt.create).not.toHaveBeenCalled();
  });

  it.each([5, 10])('rejects attempts at failure limit %i before hashing', async limit => {
    db.authIntentVerificationAttempt.count
      .mockResolvedValueOnce(limit == 5 ? 5 : 0)
      .mockResolvedValueOnce(limit == 10 ? 10 : 0);
    await expect(
      userPasswordService.verify({
        authIntentId: intent.id,
        stepId: step.id,
        password: 'secret'
      })
    ).rejects.toMatchObject({ data: { code: 'forbidden' } });
    expect(password.verify).not.toHaveBeenCalled();
  });

  it.each(['expired', 'consumed', 'fallback', 'captcha', 'removed'])(
    'rejects %s state',
    async state => {
      if (state == 'expired') intent.expiresAt = new Date(0);
      if (state == 'consumed') intent.consumedAt = new Date();
      if (state == 'fallback') intent.type = 'email_code';
      if (state == 'captcha') captcha.enabled = true;
      if (state == 'removed') db.userPassword.findUnique.mockResolvedValue(null);
      await expect(
        userPasswordService.verify({
          authIntentId: intent.id,
          stepId: step.id,
          password: 'secret'
        })
      ).rejects.toHaveProperty('data');
      expect(db.authIntent.update).not.toHaveBeenCalled();
    }
  );

  it('uses real Bun Argon2id hashing and verification', () => {
    let output = execFileSync(
      'bun',
      [
        '-e',
        `let hash = await Bun.password.hash('test-only passphrase', { algorithm: 'argon2id', memoryCost: 65536, timeCost: 2 }); console.log(JSON.stringify({ encoded: hash.startsWith('$argon2id$v=19$m=65536,t=2,p=1$'), valid: await Bun.password.verify('test-only passphrase', hash), invalid: await Bun.password.verify('wrong', hash) }));`
      ],
      { encoding: 'utf8' }
    );
    expect(JSON.parse(output)).toEqual({ encoded: true, valid: true, invalid: false });
  });
});
