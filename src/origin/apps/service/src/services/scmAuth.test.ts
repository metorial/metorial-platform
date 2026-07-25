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

vi.mock('../db', () => ({ db: mocks.db }));
vi.mock('../env', () => ({
  env: { service: { ORIGIN_SERVICE_PUBLIC_URL: 'https://origin.example.com' } }
}));
vi.mock('../lib/githubApp', () => ({
  createGitHubAppClient: () => ({ request: mocks.github.request }),
  exchangeGitHubOAuthCode: mocks.github.exchangeCode,
  getGitHubAuthenticatedUser: mocks.github.getUser,
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
