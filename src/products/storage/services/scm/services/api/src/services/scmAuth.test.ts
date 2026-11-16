import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    scmInstallationSession: { findUnique: vi.fn(), findMany: vi.fn() },
    scmInstallation: { findMany: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
    scmBackend: { findFirst: vi.fn() }
  },
  github: {
    request: vi.fn(),
    exchangeCode: vi.fn(),
    getUser: vi.fn(),
    userCanAccessInstallation: vi.fn(),
    listRequests: vi.fn(),
    getInstallationForAccount: vi.fn()
  },
  sessions: {
    setBaseline: vi.fn(),
    markPendingApproval: vi.fn(),
    complete: vi.fn(),
    getPublic: vi.fn()
  }
}));

vi.mock('../lib/scmTokenRefreshLock', () => ({
  usingScmTokenRefreshLock: async (
    _provider: string,
    _id: bigint,
    run: () => Promise<unknown>
  ) => await run()
}));

vi.mock('../db', () => ({ db: mocks.db }));
vi.mock('../env', () => ({
  env: { service: { ORIGIN_SERVICE_PUBLIC_URL: 'https://origin.example.com' } }
}));
vi.mock('../lib/githubApp', () => ({
  createGitHubAppClient: () => ({ request: mocks.github.request }),
  exchangeGitHubOAuthCode: mocks.github.exchangeCode,
  getGitHubAuthenticatedUser: mocks.github.getUser,
  gitHubUserCanAccessInstallation: mocks.github.userCanAccessInstallation,
  listGitHubInstallationRequests: mocks.github.listRequests,
  getGitHubInstallationForAccount: mocks.github.getInstallationForAccount
}));
vi.mock('../lib/scmProviderError', () => ({
  withScmProviderError: async (_provider: string, _action: string, run: () => Promise<any>) =>
    await run()
}));
vi.mock('./scmInstallationSession', () => ({
  scmInstallationSessionService: {
    setGitHubInstallationRequestBaseline: mocks.sessions.setBaseline,
    markPendingApproval: mocks.sessions.markPendingApproval,
    completeInstallationSession: mocks.sessions.complete,
    getInstallationSessionPublic: mocks.sessions.getPublic
  }
}));

import { scmAuthService } from './scmAuth';

let backend = {
  oid: 4n,
  id: 'backend',
  type: 'github',
  apiUrl: 'https://api.github.com',
  webUrl: 'https://github.com'
};

describe('GitHub SCM authorization', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.db.scmInstallationSession.findMany.mockResolvedValue([]);
    mocks.db.scmBackend.findFirst.mockResolvedValue(backend);
  });

  it('turns a request callback into pending approval with correlated account data', async () => {
    let createdAt = new Date('2030-07-24T10:00:00.000Z');
    mocks.db.scmInstallationSession.findUnique.mockResolvedValue({
      id: 'session',
      status: 'pending',
      expiresAt: new Date('2030-07-24T10:30:00.000Z'),
      createdAt,
      selectedBackend: backend,
      githubInstallationRequestBaselineIds: ['old-request']
    });
    mocks.github.exchangeCode.mockResolvedValue('token');
    mocks.github.getUser.mockResolvedValue({ id: 7 });
    mocks.github.listRequests.mockResolvedValue([
      {
        id: 22,
        created_at: '2030-07-24T10:01:00.000Z',
        requester: { id: 7 },
        account: { id: 8, login: 'metorial', type: 'Organization' }
      }
    ]);
    mocks.sessions.markPendingApproval.mockResolvedValue({
      id: 'session',
      status: 'pending_approval'
    });

    await expect(
      scmAuthService.handleInstallation({
        provider: 'github',
        setupAction: 'request',
        state: 'state',
        code: 'code'
      })
    ).resolves.toMatchObject({ kind: 'pending_approval', sessionId: 'session' });

    expect(mocks.sessions.markPendingApproval).toHaveBeenCalledWith({
      sessionId: 'session',
      requestId: '22',
      requesterId: '7',
      accountId: '8',
      accountLogin: 'metorial',
      accountType: 'organization'
    });
  });

  it('refreshes every existing installation for a state-less update callback', async () => {
    mocks.db.scmInstallation.findMany.mockResolvedValue([
      { oid: 1n, backend },
      { oid: 2n, backend }
    ]);
    mocks.github.request.mockResolvedValue({
      data: {
        id: 99,
        account: { id: 8, login: 'metorial', type: 'Organization', avatar_url: null }
      }
    });
    mocks.db.scmInstallation.updateMany.mockResolvedValue({ count: 2 });

    await expect(
      scmAuthService.handleInstallation({
        provider: 'github',
        setupAction: 'update',
        installationId: '99'
      })
    ).resolves.toMatchObject({ kind: 'succeeded', matched: true });

    expect(mocks.db.scmInstallation.findMany).toHaveBeenCalledWith({
      where: { provider: 'github', externalInstallationId: '99' },
      include: { backend: true }
    });
    expect(mocks.db.scmInstallation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ backendOid: 4n, externalInstallationId: '99' })
      })
    );
  });

  describe('setup callback with a session state', () => {
    let sessionCreatedAt = new Date('2030-07-24T10:00:00.000Z');
    let installedDuringSession = '2030-07-24T10:02:00.000Z';
    let installedBeforeSession = '2030-07-01T09:00:00.000Z';

    let useSession = (overrides: Record<string, unknown> = {}) =>
      mocks.db.scmInstallationSession.findUnique.mockResolvedValue({
        id: 'session',
        status: 'pending',
        tenantOid: 10n,
        ownerActorOid: 11n,
        expiresAt: new Date('2999-01-01T00:00:00.000Z'),
        createdAt: sessionCreatedAt,
        selectedBackend: { ...backend, tenantOid: null },
        ...overrides
      });

    let useInstallation = (createdAt: string) =>
      mocks.github.request.mockResolvedValue({
        data: {
          id: 99,
          created_at: createdAt,
          account: { id: 8, login: 'metorial', type: 'Organization', avatar_url: null }
        }
      });

    let callback = (d: { setupAction?: string; code?: string } = {}) =>
      scmAuthService.handleInstallation({
        provider: 'github',
        setupAction: d.setupAction ?? 'install',
        installationId: '99',
        state: 'state',
        code: d.code
      });

    let expectBound = () => {
      expect(mocks.db.scmInstallation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ tenantOid: 10n, externalInstallationId: '99' })
        })
      );
      expect(mocks.sessions.complete).toHaveBeenCalledWith({
        sessionId: 'session',
        installationOid: 12n
      });
    };

    let expectNotBound = () => {
      expect(mocks.db.scmInstallation.upsert).not.toHaveBeenCalled();
      expect(mocks.sessions.complete).not.toHaveBeenCalled();
    };

    beforeEach(() => {
      useSession();
      mocks.db.scmInstallation.findMany.mockResolvedValue([]);
      mocks.db.scmInstallation.upsert.mockResolvedValue({ oid: 12n });
    });

    it('binds an installation created during the session without a code', async () => {
      useInstallation(installedDuringSession);

      await expect(callback()).resolves.toMatchObject({
        kind: 'succeeded',
        sessionId: 'session'
      });

      expect(mocks.github.exchangeCode).not.toHaveBeenCalled();
      expect(mocks.db.scmInstallation.findMany).toHaveBeenCalledWith({
        where: { provider: 'github', backendOid: 4n, externalInstallationId: '99' },
        select: { tenantOid: true }
      });
      expectBound();
    });

    it('binds an installation created during the session with a code', async () => {
      useInstallation(installedDuringSession);
      mocks.github.exchangeCode.mockResolvedValue('user-token');
      mocks.github.userCanAccessInstallation.mockResolvedValue(true);

      await expect(callback({ code: 'code' })).resolves.toMatchObject({ kind: 'succeeded' });

      expect(mocks.github.exchangeCode).toHaveBeenCalledWith({
        backend: expect.objectContaining({ id: 'backend' }),
        code: 'code',
        redirectUri: 'https://origin.example.com/origin/oauth/github/callback'
      });
      expect(mocks.github.userCanAccessInstallation).toHaveBeenCalledWith({
        backend: expect.objectContaining({ id: 'backend' }),
        accessToken: 'user-token',
        installationId: '99'
      });
      expectBound();
    });

    it('binds an older installation when the code belongs to a user who can access it', async () => {
      useInstallation(installedBeforeSession);
      mocks.db.scmInstallation.findMany.mockResolvedValue([{ tenantOid: 77n }]);
      mocks.github.exchangeCode.mockResolvedValue('user-token');
      mocks.github.userCanAccessInstallation.mockResolvedValue(true);

      await expect(callback({ setupAction: 'update', code: 'code' })).resolves.toMatchObject({
        kind: 'succeeded'
      });
      expectBound();
    });

    it('refuses an older installation without a code', async () => {
      useInstallation(installedBeforeSession);

      await expect(callback()).rejects.toMatchObject({ data: { status: 403 } });
      await expect(callback({ setupAction: 'update' })).rejects.toMatchObject({
        data: { status: 403 }
      });
      expectNotBound();
    });

    it('refuses an older installation when the code belongs to a user who cannot access it', async () => {
      useInstallation(installedBeforeSession);
      mocks.github.exchangeCode.mockResolvedValue('user-token');
      mocks.github.userCanAccessInstallation.mockResolvedValue(false);

      await expect(callback({ code: 'code' })).rejects.toMatchObject({
        data: { status: 403 }
      });
      expectNotBound();
    });

    it('treats a code that cannot be exchanged like a missing code', async () => {
      mocks.github.exchangeCode.mockRejectedValue(new Error('bad_verification_code'));

      useInstallation(installedBeforeSession);
      await expect(callback({ code: 'junk' })).rejects.toMatchObject({
        data: { status: 403 }
      });
      expectNotBound();

      useInstallation(installedDuringSession);
      await expect(callback({ code: 'expired' })).resolves.toMatchObject({
        kind: 'succeeded'
      });
      expectBound();
    });

    it('refuses a new installation that another tenant already holds without a code', async () => {
      useInstallation(installedDuringSession);
      mocks.db.scmInstallation.findMany.mockResolvedValue([{ tenantOid: 77n }]);

      await expect(callback()).rejects.toMatchObject({ data: { status: 403 } });
      expectNotBound();
    });

    it('refreshes an installation the tenant already holds without a code', async () => {
      useInstallation(installedBeforeSession);
      mocks.db.scmInstallation.findMany.mockResolvedValue([
        { tenantOid: 10n },
        { tenantOid: 77n }
      ]);

      await expect(callback({ setupAction: 'update' })).resolves.toMatchObject({
        kind: 'succeeded'
      });
      expectBound();
    });

    it('binds any installation of an app the tenant owns', async () => {
      useSession({
        selectedBackend: { ...backend, type: 'github_enterprise', tenantOid: 10n }
      });
      useInstallation(installedBeforeSession);

      await expect(callback()).resolves.toMatchObject({ kind: 'succeeded' });

      expect(mocks.github.exchangeCode).not.toHaveBeenCalled();
      expectBound();
    });

    it('does not bind a second installation to a session that already succeeded', async () => {
      useSession({ status: 'succeeded' });
      useInstallation(installedDuringSession);

      await expect(callback()).resolves.toMatchObject({
        kind: 'succeeded',
        sessionId: 'session'
      });
      expect(mocks.github.request).not.toHaveBeenCalled();
      expectNotBound();
    });
  });

  it('keeps recheck pending until GitHub exposes the installation', async () => {
    let session = {
      id: 'session',
      status: 'pending_approval',
      expiresAt: new Date('2030-07-31T10:00:00.000Z'),
      selectedBackend: backend,
      githubPendingAccountLogin: 'metorial',
      githubPendingAccountType: 'organization'
    };
    mocks.sessions.getPublic.mockResolvedValue(session);
    mocks.github.getInstallationForAccount.mockResolvedValue(null);

    await expect(
      scmAuthService.recheckGitHubInstallationSession({ sessionId: 'session' })
    ).resolves.toBe(session);
    expect(mocks.sessions.complete).not.toHaveBeenCalled();
  });

  it('completes a pending session when recheck finds the installation', async () => {
    let session = {
      id: 'session',
      status: 'pending_approval',
      expiresAt: new Date('2030-07-31T10:00:00.000Z'),
      selectedBackend: backend,
      githubPendingAccountLogin: 'metorial',
      githubPendingAccountType: 'organization',
      tenantOid: 10n,
      ownerActorOid: 11n
    };
    let succeeded = { ...session, status: 'succeeded' };
    mocks.sessions.getPublic.mockResolvedValueOnce(session).mockResolvedValueOnce(succeeded);
    mocks.github.getInstallationForAccount.mockResolvedValue({
      id: 99,
      account: { id: 8, login: 'metorial', type: 'Organization', avatar_url: null }
    });
    mocks.db.scmInstallation.upsert.mockResolvedValue({ oid: 12n });

    await expect(
      scmAuthService.recheckGitHubInstallationSession({ sessionId: 'session' })
    ).resolves.toBe(succeeded);
    expect(mocks.sessions.complete).toHaveBeenCalledWith({
      sessionId: 'session',
      installationOid: 12n
    });
  });
});
