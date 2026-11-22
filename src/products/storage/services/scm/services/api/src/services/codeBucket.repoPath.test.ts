import { beforeEach, describe, expect, it, vi } from 'vitest';

let h = vi.hoisted(() => ({
  db: {
    codeBucket: { create: vi.fn(), update: vi.fn(), findFirstOrThrow: vi.fn() },
    scmRepository: { findFirstOrThrow: vi.fn() }
  },
  client: {
    exportBucketToGithub: vi.fn(),
    exportBucketToBitbucketDataCenter: vi.fn()
  },
  queues: {
    importGithub: vi.fn(),
    importGitlab: vi.fn(),
    importBitbucket: vi.fn(),
    exportGithub: vi.fn(),
    exportGitlab: vi.fn(),
    exportBitbucket: vi.fn()
  }
}));

vi.mock('../db', () => ({ db: h.db }));
vi.mock('../id', () => ({ getId: () => ({ id: 'bucket_1' }) }));
vi.mock('../lib/codeWorkspace', () => ({ codeBucketClient: h.client }));
vi.mock('../lib/bitbucket', () => ({
  getBitbucketAccessTokenWithInstallation: async () => 'token'
}));
vi.mock('../lib/githubApp', () => ({
  getInstallationAccessToken: async () => 'token',
  getGitHubTransferEndpoints: async () => ({ githubApiUrl: '', githubLfsEndpoint: '' })
}));
vi.mock('../lib/gitlab', () => ({}));
vi.mock('../lib/scmFetch', () => ({ assertScmUrlsReachable: async () => {} }));
vi.mock('../queues/codeBucket/bitbucket', () => ({
  getBitbucketCloneUrl: () => 'https://bitbucket.example.com/scm/team/repo.git'
}));
vi.mock('../queues/codeBucket/cloneBucket', () => ({}));
vi.mock('../queues/codeBucket/copyFromToBucket', () => ({}));
vi.mock('../queues/codeBucket/exportBitbucket', () => ({
  exportBitbucketQueue: { add: h.queues.exportBitbucket }
}));
vi.mock('../queues/codeBucket/exportGithub', () => ({
  exportGithubQueue: { add: h.queues.exportGithub }
}));
vi.mock('../queues/codeBucket/exportGitlab', () => ({
  exportGitlabQueue: { add: h.queues.exportGitlab }
}));
vi.mock('../queues/codeBucket/importBitbucket', () => ({
  importBitbucketQueue: { add: h.queues.importBitbucket }
}));
vi.mock('../queues/codeBucket/importGithub', () => ({
  importGithubQueue: { add: h.queues.importGithub }
}));
vi.mock('../queues/codeBucket/importGitlab', () => ({
  importGitlabQueue: { add: h.queues.importGitlab }
}));
vi.mock('../queues/codeBucket/importTemplate', () => ({}));
vi.mock('./codeBucketPurpose', () => ({
  codeBucketPurposeService: { ensurePurpose: async () => 1n }
}));
vi.mock('./repositorySyncState', () => ({
  terminalRepositorySyncStatuses: ['merged', 'failed', 'cancelled']
}));

import { codeBucketService } from './codeBucket';

let tenant = { oid: 7n, id: 'tenant_1' } as any;
let traversal = '../../../../proc/self/environ';

let repo = (provider: 'github' | 'gitlab' | 'bitbucket') =>
  ({
    oid: 5n,
    id: 'repo_1',
    provider,
    externalId: '42',
    externalOwner: 'team',
    externalName: 'repo',
    defaultBranch: 'main'
  }) as any;

beforeEach(() => {
  vi.resetAllMocks();
  h.db.codeBucket.create.mockImplementation(async ({ data }) => data);
  h.db.codeBucket.findFirstOrThrow.mockResolvedValue({ id: 'bucket_1', status: 'ready' });
});

describe('repository paths handed to the code bucket service', () => {
  it.each([
    ['github', h.queues.importGithub],
    ['gitlab', h.queues.importGitlab],
    ['bitbucket', h.queues.importBitbucket]
  ] as const)('enqueues the stored path for a %s import', async (provider, enqueue) => {
    let bucket = await codeBucketService.createCodeBucketFromRepo({
      tenant,
      purpose: 'test',
      repo: repo(provider),
      path: traversal
    });

    expect(bucket.path).toBe('/proc/self/environ');
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/proc/self/environ' })
    );
  });

  it('imports the repository root when no path is given', async () => {
    await codeBucketService.createCodeBucketFromRepo({
      tenant,
      purpose: 'test',
      repo: repo('github')
    });

    expect(h.queues.importGithub).toHaveBeenCalledWith(expect.objectContaining({ path: '/' }));
  });

  it.each([
    ['github', h.queues.importGithub],
    ['gitlab', h.queues.importGitlab],
    ['bitbucket', h.queues.importBitbucket]
  ] as const)(
    'normalises the path again when a %s bucket is re-synced',
    async (provider, enqueue) => {
      await codeBucketService.syncCodeBucketFromRepo({
        codeBucket: {
          oid: 3n,
          id: 'bucket_1',
          isSynced: true,
          path: '../skills/./docs'
        } as any,
        repo: repo(provider)
      });

      expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ path: '/skills/docs' }));
    }
  );

  it.each([
    ['github', h.queues.exportGithub],
    ['gitlab', h.queues.exportGitlab],
    ['bitbucket', h.queues.exportBitbucket]
  ] as const)('enqueues a normalised path for a %s export', async (provider, enqueue) => {
    await codeBucketService.exportCodeBucketToRepo({
      codeBucket: { id: 'bucket_1' } as any,
      repo: repo(provider),
      path: '../../etc'
    });

    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ path: '/etc' }));
  });

  it('normalises the target and delete paths of a direct GitHub export', async () => {
    h.db.scmRepository.findFirstOrThrow.mockResolvedValue({
      ...repo('github'),
      installation: { externalInstallationId: '99', backend: {} }
    });

    await codeBucketService.exportCodeBucketToRepoNow({
      codeBucket: { id: 'bucket_1' } as any,
      repo: repo('github'),
      path: 'skills/../../docs',
      deletePaths: ['../../outside.md', 'old/./file.md']
    });

    expect(h.client.exportBucketToGithub).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/docs',
        deletePaths: ['/outside.md', '/old/file.md']
      })
    );
  });

  it('normalises the target and delete paths of a direct Bitbucket Data Center export', async () => {
    h.db.scmRepository.findFirstOrThrow.mockResolvedValue({
      ...repo('bitbucket'),
      installation: { backend: { type: 'bitbucket_data_center' } }
    });

    await codeBucketService.exportCodeBucketToRepoNow({
      codeBucket: { id: 'bucket_1' } as any,
      repo: repo('bitbucket'),
      path: '../../../etc',
      deletePaths: ['../../../etc/hosts']
    });

    expect(h.client.exportBucketToBitbucketDataCenter).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/etc', deletePaths: ['/etc/hosts'] })
    );
  });
});
