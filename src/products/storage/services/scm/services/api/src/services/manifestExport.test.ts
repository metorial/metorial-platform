import Long from 'long';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let h = vi.hoisted(() => ({
  client: {
    exportBucketToGithub: vi.fn(),
    exportBucketToGitlab: vi.fn(),
    exportBucketToBitbucketCloud: vi.fn(),
    exportBucketToBitbucketDataCenter: vi.fn()
  }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: { create: (_name: string, factory: () => unknown) => ({ build: factory }) }
}));
vi.mock('../env', () => ({
  env: {
    manifestSync: {
      ORIGIN_EXPORT_SLICE_SECONDS: 600,
      ORIGIN_GITHUB_GRAPHQL_MAX_FILE_BYTES: 1_000,
      ORIGIN_GITHUB_REST_MAX_BLOB_BYTES: 2_000,
      ORIGIN_GITHUB_BATCH_INITIAL_BYTES: 3_000,
      ORIGIN_GITHUB_BATCH_MAX_BYTES: 4_000
    }
  }
}));
vi.mock('../lib/codeWorkspace', () => ({ codeBucketClient: h.client }));
vi.mock('../lib/githubApp', () => ({
  getInstallationAccessToken: async () => 'gh_token',
  getGitHubTransferEndpoints: () => ({ githubApiUrl: 'https://api.github.com' })
}));
vi.mock('../lib/gitlab', () => ({
  getGitLabAccessTokenWithInstallation: async () => 'gl_token'
}));
vi.mock('../lib/bitbucket', () => ({
  getBitbucketAccessTokenWithInstallation: async () => 'bb_token'
}));
vi.mock('../queues/codeBucket/bitbucket', () => ({
  getBitbucketCloneUrl: () => 'https://bb.example/scm/acme/skills.git'
}));

import { manifestExportService } from './manifestExport';

let sync = (provider = 'github', overrides: Record<string, unknown> = {}) =>
  ({
    branchName: 'metorial/skills-1',
    title: 'Update skills',
    manifestBucket: 'mte-files',
    manifestKey: 'skill-sync/manifests/a.ndjson',
    manifestSha256: 'a'.repeat(64),
    previousManifestBucket: 'mte-files',
    previousManifestKey: 'skill-sync/manifests/b.ndjson',
    previousManifestSha256: 'b'.repeat(64),
    deletionGuard: { maxUnexpectedDeletes: 50, maxUnexpectedDeleteRatio: 0.1 },
    allowMassDelete: false,
    gitLfsThresholdBytes: 5_000,
    repo: {
      id: 'repo_1',
      provider,
      externalId: '123',
      externalOwner: 'acme',
      externalName: 'skills',
      installation: {
        externalInstallationId: '77',
        backend: {
          type: provider === 'bitbucket' ? 'bitbucket' : provider,
          apiUrl: 'https://api.example',
          webUrl: 'https://example'
        }
      }
    },
    ...overrides
  }) as any;

let remoteState = {
  commitSha: 'c',
  treeSha: 't',
  listingBucket: 'code-bucket',
  listingKey: 'remote-state/repo_1/t.bin',
  entryCount: 9
};

beforeEach(() => {
  vi.clearAllMocks();
  for (let method of Object.values(h.client)) {
    method.mockResolvedValue({
      stats: { commitsCreated: 2, bytesUploaded: Long.fromNumber(4096), githubRequests: 9 },
      commitsCreated: 2,
      partial: true,
      newRemoteState: { ...remoteState, commitSha: 'c2' },
      retryAfterUnix: Long.fromNumber(1_800_000_000)
    });
  }
});

describe('manifest export requests', () => {
  it('sends the full ManifestSource to the GitHub exporter', async () => {
    await manifestExportService.exportManifestToRepoNow({
      sync: sync(),
      writeBudget: 25,
      remoteState
    });

    let request = h.client.exportBucketToGithub.mock.calls[0]![0];
    expect(request).toMatchObject({
      bucketId: '',
      path: '/',
      branch: 'metorial/skills-1',
      commitMessage: 'Update skills',
      deletePaths: [],
      explicitDeletesOnly: false,
      owner: 'acme',
      repo: 'skills',
      token: 'gh_token',
      manifest: {
        bucket: 'mte-files',
        key: 'skill-sync/manifests/a.ndjson',
        sha256: 'a'.repeat(64),
        previousBucket: 'mte-files',
        previousKey: 'skill-sync/manifests/b.ndjson',
        previousSha256: 'b'.repeat(64),
        maxUnexpectedDeletes: 50,
        maxUnexpectedDeleteRatio: 0.1,
        allowMassDelete: false,
        writeBudget: 25,
        sliceSeconds: 600,
        remoteState,
        remoteStateKeyPrefix: 'remote-state/repo_1/'
      }
    });
    expect(request.lfsThresholdBytes.toNumber()).toBe(5_000);
    expect(request.manifest.tuning.batchMaxBytes.toNumber()).toBe(4_000);
  });

  it('sends empty previous-manifest fields for a first sync', async () => {
    await manifestExportService.exportManifestToRepoNow({
      sync: sync('github', {
        previousManifestBucket: null,
        previousManifestKey: null,
        previousManifestSha256: null,
        deletionGuard: null
      }),
      writeBudget: 30
    });

    expect(h.client.exportBucketToGithub.mock.calls[0]![0].manifest).toMatchObject({
      previousBucket: '',
      previousKey: '',
      previousSha256: '',
      maxUnexpectedDeletes: 0,
      maxUnexpectedDeleteRatio: 0,
      remoteState: undefined
    });
  });

  it('normalizes the response', async () => {
    await expect(
      manifestExportService.exportManifestToRepoNow({ sync: sync(), writeBudget: 30 })
    ).resolves.toMatchObject({
      stats: { commitsCreated: 2, bytesUploaded: 4096, githubRequests: 9, filesTotal: 0 },
      commitsCreated: 2,
      partial: true,
      newRemoteState: { commitSha: 'c2' },
      retryAfter: new Date(1_800_000_000_000)
    });
  });

  it.each([
    [
      'gitlab',
      'exportBucketToGitlab',
      { token: 'gl_token', gitlabApiUrl: 'https://api.example' }
    ],
    ['bitbucket', 'exportBucketToBitbucketCloud', { token: 'bb_token', workspace: 'acme' }]
  ] as const)('dispatches %s syncs to %s', async (provider, method, fields) => {
    await manifestExportService.exportManifestToRepoNow({
      sync: sync(provider),
      writeBudget: 30
    });

    let request = h.client[method].mock.calls[0]![0];
    expect(request).toMatchObject({
      ...fields,
      manifest: expect.objectContaining({ writeBudget: 30 })
    });
    expect(request.lfsThresholdBytes.toNumber()).toBe(5_000);
    expect(h.client.exportBucketToGithub).not.toHaveBeenCalled();
  });

  it('dispatches Bitbucket Data Center syncs over git', async () => {
    let dcSync = sync('bitbucket');
    dcSync.repo.installation.backend.type = 'bitbucket_data_center';

    await manifestExportService.exportManifestToRepoNow({ sync: dcSync, writeBudget: 30 });

    let request = h.client.exportBucketToBitbucketDataCenter.mock.calls[0]![0];
    expect(request).toMatchObject({
      cloneUrl: 'https://bb.example/scm/acme/skills.git',
      token: 'bb_token'
    });
    expect(request.lfsThresholdBytes.toNumber()).toBe(5_000);
  });

  it('refuses a sync without a manifest', async () => {
    await expect(
      manifestExportService.exportManifestToRepoNow({
        sync: sync('github', { manifestKey: null }),
        writeBudget: 30
      })
    ).rejects.toThrow('Repository sync has no manifest');
  });
});
