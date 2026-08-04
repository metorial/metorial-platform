import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, auditLogService, deviceService, markAresUserChanged, clear, clearByTag } =
  vi.hoisted(() => ({
    db: {
      authDeviceUserSession: { findUnique: vi.fn(), update: vi.fn() },
      app: { findUnique: vi.fn() }
    },
    auditLogService: { log: vi.fn() },
    deviceService: { recordDeviceUse: vi.fn() },
    markAresUserChanged: vi.fn(),
    clear: vi.fn(),
    clearByTag: vi.fn()
  }));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name: string, factory: () => unknown) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/cache', () => ({
  createCachedFunction: () => Object.assign(vi.fn(), { clear, clearByTag })
}));

vi.mock('../db', () => ({ db }));

vi.mock('../env', () => ({ env: { service: { REDIS_URL: 'redis://localhost:6379' } } }));

vi.mock('../id', () => ({ getId: vi.fn() }));

vi.mock('./auditLog', () => ({ auditLogService }));

vi.mock('./device', () => ({ deviceService }));

vi.mock('../queues/syncCallback', () => ({ markAresUserChanged }));

import { sessionService } from './session';

let APP_OID = 5n;
let SLUG = 'horizon';
let OWNER = 'horizon';

let expiresAt = new Date('2026-09-01T00:00:00.000Z');

let session = (overrides: Record<string, unknown> = {}) => ({
  oid: 10n,
  id: 'adus_1',
  appOid: APP_OID,
  loggedOutAt: null,
  expiresAt: new Date('2026-08-20T00:00:00.000Z'),
  lifecycleOwner: null,
  lifecycleOwnerSessionId: null,
  lifecycleOwnerRevision: null,
  lifecycleClaimedAt: null,
  ...overrides
});

let apply = (overrides: Record<string, unknown> = {}) =>
  sessionService.applyOwnerState({
    sessionId: 'adus_1',
    owner: OWNER,
    ownerSessionId: 'aus_1',
    ownerRevision: 3n,
    appSlug: SLUG,
    state: 'active',
    expiresAt,
    logoutUrl: 'https://passport.test/logout',
    ...overrides
  } as any);

let lastUpdateData = () => db.authDeviceUserSession.update.mock.calls.at(-1)![0].data;

describe('sessionService.applyOwnerState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.app.findUnique.mockResolvedValue({ oid: APP_OID, slug: SLUG });
    db.authDeviceUserSession.update.mockResolvedValue({});
  });

  it('claims an unclaimed session and applies the pushed expiry', async () => {
    db.authDeviceUserSession.findUnique.mockResolvedValue(session());

    await expect(apply()).resolves.toEqual({ applied: true });

    expect(lastUpdateData()).toMatchObject({
      loggedOutAt: null,
      expiresAt,
      lifecycleOwner: OWNER,
      lifecycleOwnerSessionId: 'aus_1',
      lifecycleOwnerRevision: 3n,
      lifecycleOwnerLogoutUrl: 'https://passport.test/logout'
    });
    expect(clear).toHaveBeenCalledWith({ sessionId: 'adus_1' });
  });

  it('claims a session that predates ownership when it is logged out', async () => {
    db.authDeviceUserSession.findUnique.mockResolvedValue(session());

    await expect(apply({ state: 'logged_out' })).resolves.toEqual({ applied: true });

    let data = lastUpdateData();
    expect(data.loggedOutAt).toBeInstanceOf(Date);
    expect(data.lifecycleOwner).toBe(OWNER);
  });

  it('refuses a session that belongs to another app', async () => {
    db.authDeviceUserSession.findUnique.mockResolvedValue(session({ appOid: 99n }));

    await expect(apply()).rejects.toThrow();
    expect(db.authDeviceUserSession.update).not.toHaveBeenCalled();
  });

  it('refuses an app slug that does not exist', async () => {
    db.authDeviceUserSession.findUnique.mockResolvedValue(session());
    db.app.findUnique.mockResolvedValue(null);

    await expect(apply()).rejects.toThrow();
  });

  it('refuses a session claimed by a different owner', async () => {
    db.authDeviceUserSession.findUnique.mockResolvedValue(
      session({ lifecycleOwner: 'someone-else', lifecycleOwnerSessionId: 'other_1' })
    );

    await expect(apply()).resolves.toEqual({
      applied: false,
      reason: 'owned_by_other'
    });
    expect(db.authDeviceUserSession.update).not.toHaveBeenCalled();
  });

  it('ignores a revision it has already applied', async () => {
    db.authDeviceUserSession.findUnique.mockResolvedValue(
      session({
        lifecycleOwner: OWNER,
        lifecycleOwnerSessionId: 'aus_1',
        lifecycleOwnerRevision: 3n
      })
    );

    await expect(apply({ ownerRevision: 3n })).resolves.toEqual({
      applied: false,
      reason: 'stale_revision'
    });
    expect(db.authDeviceUserSession.update).not.toHaveBeenCalled();
  });

  it('keeps the session alive when a replaced owner session reports a logout', async () => {
    db.authDeviceUserSession.findUnique.mockResolvedValue(
      session({
        lifecycleOwner: OWNER,
        lifecycleOwnerSessionId: 'aus_2',
        lifecycleOwnerRevision: 1n
      })
    );

    await expect(apply({ ownerSessionId: 'aus_1', state: 'logged_out' })).resolves.toEqual({
      applied: false,
      reason: 'stale_owner_session'
    });
    expect(db.authDeviceUserSession.update).not.toHaveBeenCalled();
  });

  it('lets a new activation take the claim over from another owner session', async () => {
    db.authDeviceUserSession.findUnique.mockResolvedValue(
      session({
        lifecycleOwner: OWNER,
        lifecycleOwnerSessionId: 'aus_2',
        lifecycleOwnerRevision: 9n,
        lifecycleClaimedAt: new Date('2026-08-01T00:00:00.000Z')
      })
    );

    await expect(apply({ ownerSessionId: 'aus_3', ownerRevision: 1n })).resolves.toEqual({
      applied: true
    });

    expect(lastUpdateData()).toMatchObject({
      lifecycleOwnerSessionId: 'aus_3',
      lifecycleOwnerRevision: 1n,
      loggedOutAt: null,
      expiresAt
    });
  });

  it('leaves the lifecycle untouched when a session is superseded', async () => {
    let current = session({
      lifecycleOwner: OWNER,
      lifecycleOwnerSessionId: 'aus_1',
      lifecycleOwnerRevision: 1n
    });
    db.authDeviceUserSession.findUnique.mockResolvedValue(current);

    await expect(apply({ state: 'superseded' })).resolves.toEqual({ applied: true });

    let data = lastUpdateData();
    expect(data).not.toHaveProperty('loggedOutAt');
    expect(data).not.toHaveProperty('expiresAt');
    expect(data).toMatchObject({ lifecycleOwnerRevision: 3n });
  });

  it('closes the session when the owner reports a terminal state', async () => {
    db.authDeviceUserSession.findUnique.mockResolvedValue(
      session({
        lifecycleOwner: OWNER,
        lifecycleOwnerSessionId: 'aus_1',
        lifecycleOwnerRevision: 1n
      })
    );

    for (let state of ['logged_out', 'expired', 'revoked'] as const) {
      db.authDeviceUserSession.update.mockClear();

      await expect(apply({ state })).resolves.toEqual({ applied: true });

      let data = lastUpdateData();
      expect(data.loggedOutAt).toBeInstanceOf(Date);
      expect(data.expiresAt).toBeInstanceOf(Date);
      expect(data.expiresAt).not.toEqual(expiresAt);
    }
  });

  it('never revives a session ares has already closed', async () => {
    db.authDeviceUserSession.findUnique.mockResolvedValue(
      session({
        loggedOutAt: new Date('2026-08-02T00:00:00.000Z'),
        lifecycleOwner: OWNER,
        lifecycleOwnerSessionId: 'aus_1',
        lifecycleOwnerRevision: 1n
      })
    );

    await expect(apply()).resolves.toEqual({
      applied: false,
      reason: 'session_closed'
    });
    expect(db.authDeviceUserSession.update).not.toHaveBeenCalled();
  });

  it('keeps the original logout time when a closed session is reported terminal', async () => {
    let loggedOutAt = new Date('2026-08-02T00:00:00.000Z');
    db.authDeviceUserSession.findUnique.mockResolvedValue(
      session({
        loggedOutAt,
        lifecycleOwner: OWNER,
        lifecycleOwnerSessionId: 'aus_1',
        lifecycleOwnerRevision: 1n
      })
    );

    await expect(apply({ state: 'logged_out' })).resolves.toEqual({ applied: true });
    expect(lastUpdateData().loggedOutAt).toEqual(loggedOutAt);
  });
});

describe('sessionService.logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.authDeviceUserSession.update.mockResolvedValue({
      id: 'adus_1',
      user: { oid: 1n, appOid: APP_OID },
      device: { lastIp: '1.2.3.4', lastUa: 'agent' }
    });
  });

  it('logs an unowned session out', async () => {
    await sessionService.logout({ session: session() as any });

    expect(db.authDeviceUserSession.update).toHaveBeenCalled();
  });

  it('refuses to log an owned session out without its owner', async () => {
    await expect(
      sessionService.logout({ session: session({ lifecycleOwner: OWNER }) as any })
    ).rejects.toThrow(/owned by horizon/);

    expect(db.authDeviceUserSession.update).not.toHaveBeenCalled();
  });

  it('refuses to log an owned session out for a different owner', async () => {
    await expect(
      sessionService.logout({
        session: session({ lifecycleOwner: OWNER }) as any,
        owner: 'octane'
      })
    ).rejects.toThrow();

    expect(db.authDeviceUserSession.update).not.toHaveBeenCalled();
  });

  it('logs an owned session out for its owner', async () => {
    await sessionService.logout({
      session: session({ lifecycleOwner: OWNER }) as any,
      owner: OWNER
    });

    expect(db.authDeviceUserSession.update).toHaveBeenCalled();
  });
});
