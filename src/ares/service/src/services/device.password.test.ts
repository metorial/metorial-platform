import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, password, userService, transaction } = vi.hoisted(() => ({
  db: {
    authAttempt: { updateMany: vi.fn() },
    authDevice: { findUniqueOrThrow: vi.fn() },
    user: { findUniqueOrThrow: vi.fn() },
    account: { findUnique: vi.fn() },
    authDeviceUserSession: { findFirst: vi.fn(), create: vi.fn() }
  },
  password: { assertVerifiedPassword: vi.fn() },
  userService: { recordLogin: vi.fn() },
  transaction: { active: false }
}));

vi.mock('../db', () => ({
  db,
  withTransaction: async (fn: (db: unknown) => unknown) => {
    transaction.active = true;
    try {
      return await fn(db);
    } finally {
      transaction.active = false;
    }
  }
}));
vi.mock('../id', () => ({ getId: () => ({ oid: 10n, id: 'session_1' }), snowflake: {} }));
vi.mock('../queues/syncCallback', () => ({ markAresUserChanged: vi.fn() }));
vi.mock('./auditLog', () => ({ auditLogService: { log: vi.fn() } }));
vi.mock('./user', () => ({ userService }));
vi.mock('./userPassword', () => ({ userPasswordService: password }));
vi.mock('@lowerdeck/service', () => ({
  Service: { create: (_: string, factory: () => unknown) => ({ build: factory }) }
}));

import { deviceService } from './device';

let attempt = {
  id: 'attempt_1',
  userOid: 1n,
  deviceOid: 2n,
  appOid: 3n,
  accountOid: null,
  authIntentOid: 4n,
  loginMethod: 'password',
  ip: '127.0.0.1',
  ua: 'test'
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  db.authAttempt.updateMany.mockResolvedValue({ count: 1 });
  db.authDevice.findUniqueOrThrow.mockResolvedValue({ oid: attempt.deviceOid });
  db.user.findUniqueOrThrow.mockResolvedValue({
    oid: attempt.userOid,
    appOid: attempt.appOid,
    app: { isSessionless: false }
  });
  db.authDeviceUserSession.findFirst.mockResolvedValue(null);
  db.authDeviceUserSession.create.mockImplementation(async ({ data }) => data);
  password.assertVerifiedPassword.mockImplementation(async () => {
    expect(transaction.active).toBe(true);
  });
});

describe('password credential checks during session exchange', () => {
  it('rechecks the verified credential inside the session transaction before consuming the attempt', async () => {
    await expect(
      deviceService.exchangeAuthAttemptForSession({ authAttempt: attempt })
    ).resolves.toMatchObject({ id: 'session_1' });
    expect(password.assertVerifiedPassword).toHaveBeenCalledWith({
      userOid: attempt.userOid,
      authIntentOid: attempt.authIntentOid
    });
    expect(password.assertVerifiedPassword.mock.invocationCallOrder[0]).toBeLessThan(
      db.authAttempt.updateMany.mock.invocationCallOrder[0]!
    );
    expect(db.authDeviceUserSession.create).toHaveBeenCalledTimes(1);
  });

  it.each(['removed', 'replaced'])(
    'rejects a %s password between completion and exchange without creating a session',
    async state => {
      password.assertVerifiedPassword.mockRejectedValueOnce(new Error(`Password ${state}`));

      await expect(
        deviceService.exchangeAuthAttemptForSession({ authAttempt: attempt })
      ).rejects.toThrow(`Password ${state}`);
      expect(db.authAttempt.updateMany).not.toHaveBeenCalled();
      expect(db.authDeviceUserSession.create).not.toHaveBeenCalled();
      expect(userService.recordLogin).not.toHaveBeenCalled();
    }
  );

  it('rejects a password attempt without a bound intent', async () => {
    await expect(
      deviceService.exchangeAuthAttemptForSession({
        authAttempt: { ...attempt, authIntentOid: null }
      })
    ).rejects.toMatchObject({ data: { code: 'unauthorized' } });
    expect(db.authAttempt.updateMany).not.toHaveBeenCalled();
  });

  it('retains the code-only exchange flow', async () => {
    await expect(
      deviceService.exchangeAuthAttemptForSession({
        authAttempt: { ...attempt, loginMethod: 'email' }
      })
    ).resolves.toMatchObject({ id: 'session_1' });
    expect(password.assertVerifiedPassword).not.toHaveBeenCalled();
  });

  it('checks the password revision even when reusing an existing device session', async () => {
    db.authDeviceUserSession.findFirst.mockResolvedValueOnce({ id: 'existing_session' });
    await expect(
      deviceService.exchangeAuthAttemptForSession({ authAttempt: attempt })
    ).resolves.toMatchObject({ id: 'existing_session' });
    expect(password.assertVerifiedPassword).toHaveBeenCalledTimes(1);
    expect(db.authDeviceUserSession.create).not.toHaveBeenCalled();
  });
});
