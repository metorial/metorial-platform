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

import {
  createBitbucketClientWithToken,
  getBitbucketAccessTokenWithInstallation,
  getBitbucketOAuthUrl
} from './bitbucket';

let backend = (type: 'bitbucket' | 'bitbucket_data_center' = 'bitbucket') =>
  ({
    type,
    apiUrl:
      type === 'bitbucket'
        ? 'https://api.bitbucket.org/2.0'
        : 'https://stash.example.com/rest/api/1.0',
    webUrl: type === 'bitbucket' ? 'https://bitbucket.org' : 'https://stash.example.com',
    clientId: 'client-id',
    clientSecret: 'client-secret'
  }) as any;

let installation = (overrides: Record<string, unknown> = {}) =>
  ({
    oid: 42n,
    accessToken: 'old-access-token',
    refreshToken: 'old-refresh-token',
    accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    backend: backend(),
    ...overrides
  }) as any;

describe('Bitbucket OAuth and REST client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.db.scmInstallation.findUnique.mockReset();
    mocks.db.scmInstallation.update.mockReset();
    mocks.usingTokenRefreshLock.mockReset();
    mocks.usingTokenRefreshLock.mockImplementation(
      async (_provider, _installationOid, fn) => await fn()
    );
  });

  it('builds Cloud and Data Center authorization URLs', () => {
    let cloud = new URL(
      getBitbucketOAuthUrl({
        backend: backend(),
        redirectUri: 'https://origin.example/callback',
        state: 'state'
      })
    );
    let dataCenter = new URL(
      getBitbucketOAuthUrl({
        backend: backend('bitbucket_data_center'),
        redirectUri: 'https://origin.example/callback',
        state: 'state'
      })
    );

    expect(cloud.origin + cloud.pathname).toBe('https://bitbucket.org/site/oauth2/authorize');
    expect(dataCenter.origin + dataCenter.pathname).toBe(
      'https://stash.example.com/rest/oauth2/latest/authorize'
    );
    expect(cloud.searchParams.get('state')).toBe('state');
  });

  it('follows all Cloud pagination links', async () => {
    let fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        Response.json({
          values: [
            {
              workspace: {
                uuid: 'one',
                name: 'One',
                slug: 'one'
              }
            }
          ],
          next: 'https://api.bitbucket.org/2.0/user/workspaces?page=2'
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          values: [{ workspace: { uuid: 'two', name: 'Two', slug: 'two' } }]
        })
      );

    let client = createBitbucketClientWithToken('token', backend());
    let accounts = await client.listAccounts();

    expect(accounts.map(account => account.slug)).toEqual(['one', 'two']);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/2.0/user/workspaces?pagelen=100');
  });

  it('lists repositories across accessible Cloud workspaces when no workspace is selected', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        Response.json({
          values: [
            {
              workspace: { uuid: 'workspace-one', name: 'One', slug: 'one' }
            },
            {
              workspace: { uuid: 'workspace-two', name: 'Two', slug: 'two' }
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          values: [
            {
              uuid: 'repo-one',
              name: 'Repository One',
              slug: 'repository-one',
              is_private: true,
              workspace: { uuid: 'workspace-one', name: 'One', slug: 'one' },
              links: { html: { href: 'https://bitbucket.org/one/repository-one' } }
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          values: [
            {
              uuid: 'repo-two',
              name: 'Repository Two',
              slug: 'repository-two',
              is_private: true,
              workspace: { uuid: 'workspace-two', name: 'Two', slug: 'two' },
              links: { html: { href: 'https://bitbucket.org/two/repository-two' } }
            }
          ]
        })
      );

    let client = createBitbucketClientWithToken('token', backend());
    await expect(client.listRepositories()).resolves.toMatchObject([
      { id: 'one/repository-one' },
      { id: 'two/repository-two' }
    ]);
    expect(String(vi.mocked(fetch).mock.calls[1]?.[0])).toContain('/2.0/repositories/one');
    expect(String(vi.mocked(fetch).mock.calls[2]?.[0])).toContain('/2.0/repositories/two');
  });

  it('resolves the current Data Center user through whoami', async () => {
    let fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response('tobias', {
          headers: { 'X-AUSERNAME': 'tobias' }
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          id: 42,
          name: 'tobias',
          slug: 'tobias',
          displayName: 'Tobias'
        })
      );

    let client = createBitbucketClientWithToken('token', backend('bitbucket_data_center'));
    await expect(client.getCurrentUser()).resolves.toEqual({
      id: '42',
      name: 'Tobias',
      slug: 'tobias',
      type: 'user',
      imageUrl: null
    });
    expect(fetch.mock.calls[0]?.[0]).toBe(
      'https://stash.example.com/plugins/servlet/applinks/whoami'
    );
  });

  it('loads Data Center default branches and uses browser repository URLs', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        Response.json({
          id: 1,
          name: 'Repository',
          slug: 'repo',
          public: false,
          project: { id: 2, key: 'PROJ', name: 'Project' }
        })
      )
      .mockResolvedValueOnce(Response.json({ displayId: 'master' }));

    let client = createBitbucketClientWithToken('token', backend('bitbucket_data_center'));
    await expect(client.getRepository('PROJ', 'repo')).resolves.toMatchObject({
      defaultBranch: 'master',
      webUrl: 'https://stash.example.com/projects/PROJ/repos/repo/browse'
    });
  });

  it('sends the Data Center pull request version as a merge query parameter', async () => {
    let fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        Response.json({
          id: 7,
          version: 3,
          state: 'OPEN',
          links: { self: [{ href: 'https://stash.example.com/pr/7' }] }
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          id: 7,
          version: 4,
          state: 'MERGED',
          links: { self: [{ href: 'https://stash.example.com/pr/7' }] }
        })
      );

    let client = createBitbucketClientWithToken('token', backend('bitbucket_data_center'));
    await expect(client.mergePullRequest('PROJ/repo', '7')).resolves.toMatchObject({
      state: 'MERGED',
      version: 4
    });
    expect(String(fetch.mock.calls[1]?.[0])).toBe(
      'https://stash.example.com/rest/api/1.0/projects/PROJ/repos/repo/pull-requests/7/merge?version=3'
    );
  });

  it('resolves Cloud branch names to commit hashes before creating branches', async () => {
    let fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ target: { hash: 'base-sha' } }))
      .mockResolvedValueOnce(Response.json({}));

    let client = createBitbucketClientWithToken('token', backend());
    await client.createBranch('workspace/repo', 'metorial/sync', 'main');

    expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))).toEqual({
      name: 'metorial/sync',
      target: { hash: 'base-sha' }
    });
  });

  it('reads and normalizes Cloud webhook configuration', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        uuid: '{hook-id}',
        url: 'https://origin.example/hook',
        active: true,
        events: ['repo:push', 'pullrequest:created']
      })
    );
    let client = createBitbucketClientWithToken('token', backend());

    await expect(client.getWebhook('workspace/repo', '{hook-id}')).resolves.toEqual({
      id: '{hook-id}',
      url: 'https://origin.example/hook',
      active: true,
      events: ['repo:push', 'pullrequest:created']
    });
  });

  it('uses the adapter-provided event set when updating a webhook', async () => {
    let fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({}));
    let client = createBitbucketClientWithToken('token', backend());

    await client.updateWebhook({
      repositoryId: 'workspace/repo',
      webhookId: '{hook-id}',
      url: 'https://origin.example/hook',
      secret: 'secret',
      events: ['repo:push']
    });

    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toMatchObject({
      url: 'https://origin.example/hook',
      active: true,
      secret: 'secret',
      events: ['repo:push']
    });
  });

  it('persists rotated refresh credentials', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 7200
      })
    );

    await expect(
      getBitbucketAccessTokenWithInstallation(
        installation({ accessTokenExpiresAt: new Date(Date.now() + 60_000) })
      )
    ).resolves.toBe('new-access-token');

    expect(mocks.db.scmInstallation.update).toHaveBeenCalledWith({
      where: { oid: 42n },
      data: {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        accessTokenExpiresAt: expect.any(Date)
      }
    });
  });

  it('uses credentials won by a concurrent rotating refresh', async () => {
    let fetch = vi.spyOn(globalThis, 'fetch');
    mocks.db.scmInstallation.findUnique.mockResolvedValue({
      accessToken: 'winner-access-token',
      refreshToken: 'winner-refresh-token',
      accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });

    await expect(
      getBitbucketAccessTokenWithInstallation(
        installation({ accessTokenExpiresAt: new Date(0) })
      )
    ).resolves.toBe('winner-access-token');
    expect(mocks.usingTokenRefreshLock).toHaveBeenCalledWith(
      'bitbucket',
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

    await expect(
      getBitbucketAccessTokenWithInstallation(
        installation({ accessTokenExpiresAt: new Date(0) })
      )
    ).resolves.toBe('winner-access-token');
  });
});
