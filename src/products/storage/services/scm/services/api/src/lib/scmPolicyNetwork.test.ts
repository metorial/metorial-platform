import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import type { ScmBackend } from '../../prisma/generated/client';

let mocks = vi.hoisted(() => ({
  octokit: vi.fn(function () {
    return {};
  }),
  fetch: vi.fn()
}));

vi.mock('@octokit/core', () => ({ Octokit: mocks.octokit }));
vi.mock('../env', () => ({
  delegateSecretsToNebula: false,
  env: { gh: { SCM_GITHUB_APP_ID: 'environment-app-id' } },
  SCM_GITHUB_APP_PRIVATE_KEY: 'environment-private-key'
}));
vi.mock('./scmTokenRefreshLock', () => ({
  usingScmTokenRefreshLock: async (
    _provider: string,
    _id: bigint,
    run: () => Promise<unknown>
  ) => run()
}));

let original = { ...process.env };

let github: typeof import('./githubApp');

let gitlab: typeof import('./gitlab');

let bitbucket: typeof import('./bitbucket');

let backend = {
  type: 'github_enterprise',
  tenantOid: 1n,
  isDefault: false,
  webUrl: 'https://git.example.com',
  apiUrl: 'https://git.example.com/api/v3',
  appId: 'configured-app-id',
  appPrivateKey: 'configured-private-key'
} as ScmBackend;

beforeAll(async () => {
  process.env.METORIAL_EDITION = 'on-prem';
  process.env.ORIGIN_SCM_ALLOWED_PROVIDER_TYPES = 'github_enterprise';
  process.env.ORIGIN_SCM_ALLOWED_DOMAINS = 'git.example.com';
  vi.stubGlobal('fetch', mocks.fetch);
  github = await import('./githubApp');
  gitlab = await import('./gitlab');
  bitbucket = await import('./bitbucket');
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  process.env = { ...original };
  vi.unstubAllGlobals();
});

it('does not fall back to environment app credentials', async () => {
  await expect(github.createGitHubAppClient()).rejects.toThrow(/Configure/);
  expect(mocks.octokit).not.toHaveBeenCalled();
});

it('rejects a locked domain before constructing a client or exchanging a token', async () => {
  let denied = { ...backend, webUrl: 'https://other.example.com' };
  await expect(github.createGitHubAppClient(denied)).rejects.toThrow(/domain/);
  await expect(
    github.exchangeGitHubOAuthCode({
      backend: denied,
      code: 'code',
      redirectUri: 'https://origin.example/callback'
    })
  ).rejects.toThrow(/domain/);
  expect(mocks.octokit).not.toHaveBeenCalled();
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it('uses only configured app credentials and endpoints for an allowed backend', async () => {
  await github.createGitHubAppClient(backend);
  expect(mocks.octokit).toHaveBeenCalledWith(
    expect.objectContaining({
      baseUrl: backend.apiUrl,
      auth: { appId: 'configured-app-id', privateKey: 'configured-private-key' }
    })
  );
  await expect(github.getGitHubTransferEndpoints(backend, 'owner', 'repo')).resolves.toEqual({
    githubApiUrl: backend.apiUrl,
    githubLfsEndpoint: 'https://git.example.com/owner/repo.git/info/lfs'
  });
});

it('rejects disabled GitLab and Bitbucket connections before returning cached tokens', async () => {
  let installation = {
    accessToken: 'cached',
    accessTokenExpiresAt: new Date(Date.now() + 3600_000)
  };
  await expect(
    gitlab.getGitLabAccessTokenWithInstallation({
      ...installation,
      backend: { ...backend, type: 'gitlab_selfhosted' }
    } as any)
  ).rejects.toThrow(/disabled/);
  await expect(
    bitbucket.getBitbucketAccessTokenWithInstallation({
      ...installation,
      backend: { ...backend, type: 'bitbucket_data_center' }
    } as any)
  ).rejects.toThrow(/disabled/);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
