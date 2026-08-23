import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    scmInstallation: {
      findUnique: vi.fn(),
      update: vi.fn()
    }
  },
  usingTokenRefreshLock: vi.fn()
}));

vi.mock('../db', () => ({ db: mocks.db }));
vi.mock('./scmTokenRefreshLock', () => ({
  usingScmTokenRefreshLock: mocks.usingTokenRefreshLock
}));

import { getGitLabAccessTokenWithInstallation } from './gitlab';

let createInstallation = (overrides: Record<string, unknown> = {}) =>
  ({
    oid: 42n,
    accessToken: 'old-access-token',
    refreshToken: 'old-refresh-token',
    accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    backend: {
      webUrl: 'https://gitlab.example.com',
      clientId: 'client-id',
      clientSecret: 'client-secret'
    },
    ...overrides
  }) as any;

describe('GitLab installation access tokens', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.db.scmInstallation.findUnique.mockReset();
    mocks.db.scmInstallation.update.mockReset();
    mocks.usingTokenRefreshLock.mockReset();
    mocks.usingTokenRefreshLock.mockImplementation(
      async (_provider, _installationOid, fn) => await fn()
    );
  });

  it('uses a token that is not close to expiring', async () => {
    let fetch = vi.spyOn(globalThis, 'fetch');
    let installation = createInstallation();

    await expect(getGitLabAccessTokenWithInstallation(installation)).resolves.toBe(
      'old-access-token'
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.db.scmInstallation.update).not.toHaveBeenCalled();
  });

  it('refreshes a near-expiry token and persists rotated credentials', async () => {
    let fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          token_type: 'Bearer',
          expires_in: 7200
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    let installation = createInstallation({
      accessTokenExpiresAt: new Date(Date.now() + 4 * 60 * 1000)
    });

    await expect(getGitLabAccessTokenWithInstallation(installation)).resolves.toBe(
      'new-access-token'
    );

    expect(fetch).toHaveBeenCalledWith(
      'https://gitlab.example.com/oauth/token',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          client_id: 'client-id',
          client_secret: 'client-secret',
          refresh_token: 'old-refresh-token',
          grant_type: 'refresh_token'
        })
      })
    );
    expect(mocks.db.scmInstallation.update).toHaveBeenCalledWith({
      where: { oid: 42n },
      data: {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        accessTokenExpiresAt: expect.any(Date)
      }
    });
  });

  it('uses credentials persisted by a concurrent refresh winner', async () => {
    let fetch = vi.spyOn(globalThis, 'fetch');
    mocks.db.scmInstallation.findUnique.mockResolvedValue({
      accessToken: 'winner-access-token',
      refreshToken: 'winner-refresh-token',
      accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });
    let installation = createInstallation({ accessTokenExpiresAt: new Date(0) });

    await expect(getGitLabAccessTokenWithInstallation(installation)).resolves.toBe(
      'winner-access-token'
    );
    expect(mocks.db.scmInstallation.findUnique).toHaveBeenCalledWith({
      where: { oid: 42n }
    });
    expect(mocks.usingTokenRefreshLock).toHaveBeenCalledWith(
      'gitlab',
      42n,
      expect.any(Function)
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses credentials persisted while a refresh request is in flight', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
    mocks.db.scmInstallation.findUnique
      .mockResolvedValueOnce({
        accessToken: 'old-access-token',
        refreshToken: 'old-refresh-token',
        accessTokenExpiresAt: new Date(0)
      })
      .mockResolvedValueOnce({
        accessToken: 'winner-access-token',
        refreshToken: 'winner-refresh-token',
        accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000)
      });
    let installation = createInstallation({ accessTokenExpiresAt: new Date(0) });

    await expect(getGitLabAccessTokenWithInstallation(installation)).resolves.toBe(
      'winner-access-token'
    );
  });

  it('surfaces an invalid refresh token when no concurrent refresh won', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
    mocks.db.scmInstallation.findUnique.mockResolvedValue({
      accessToken: 'old-access-token',
      refreshToken: 'old-refresh-token',
      accessTokenExpiresAt: new Date(0)
    });
    let installation = createInstallation({ accessTokenExpiresAt: new Date(0) });

    await expect(getGitLabAccessTokenWithInstallation(installation)).rejects.toMatchObject({
      data: { status: 401, code: 'unauthorized' }
    });
  });
});
