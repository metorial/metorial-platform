import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock all external dependencies before importing
vi.mock('@metorial/db', () => ({
  db: {
    scmRepo: {
      findFirstOrThrow: vi.fn()
    },
    codeBucket: {
      updateMany: vi.fn()
    }
  }
}));

vi.mock('@metorial/delay', () => ({
  delay: vi.fn()
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn((config) => ({
    process: (fn: any) => fn,
    add: vi.fn()
  }))
}));

vi.mock('../src/lib/codeWorkspace', () => ({
  codeWorkspaceClient: {
    createBucketFromGithub: vi.fn()
  }
}));

// Import after mocking
import { db } from '@metorial/db';
import { delay } from '@metorial/delay';
import { codeWorkspaceClient } from '../src/lib/codeWorkspace';
import { importGithubQueueProcessor } from '../src/queue/importGithub';

// Type helper for queue processor
const processor = importGithubQueueProcessor as unknown as (data: {
  newBucketId: string;
  owner: string;
  repo: string;
  ref: string;
  path: string;
  repoId: string;
}) => Promise<void>;

describe('importGithub queue processor', () => {
  const mockData = {
    newBucketId: 'bucket_123',
    owner: 'testowner',
    repo: 'testrepo',
    ref: 'main',
    path: '/src',
    repoId: 'repo_123'
  };

  const mockRepoWithInstallation = {
    id: 'repo_123',
    oid: 1n,
    provider: 'github',
    installation: {
      accessToken: 'gh_token_123'
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should import GitHub repository into bucket', async () => {
    vi.mocked(db.scmRepo.findFirstOrThrow).mockResolvedValue(mockRepoWithInstallation as any);
    vi.mocked(codeWorkspaceClient.createBucketFromGithub).mockResolvedValue({} as any);
    vi.mocked(delay).mockResolvedValue(undefined);
    vi.mocked(db.codeBucket.updateMany).mockResolvedValue({ count: 1 } as any);

    await processor(mockData);

    expect(db.scmRepo.findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: 'repo_123' },
      include: { installation: true }
    });

    expect(codeWorkspaceClient.createBucketFromGithub).toHaveBeenCalledWith({
      newBucketId: 'bucket_123',
      owner: 'testowner',
      repo: 'testrepo',
      ref: 'main',
      path: '/src',
      token: 'gh_token_123'
    });

    expect(delay).toHaveBeenCalledWith(2000);

    expect(db.codeBucket.updateMany).toHaveBeenCalledWith({
      where: { id: 'bucket_123' },
      data: { status: 'ready' }
    });
  });

  it('should handle different repository paths', async () => {
    const dataWithRootPath = {
      ...mockData,
      path: '/'
    };

    vi.mocked(db.scmRepo.findFirstOrThrow).mockResolvedValue(mockRepoWithInstallation as any);
    vi.mocked(codeWorkspaceClient.createBucketFromGithub).mockResolvedValue({} as any);
    vi.mocked(delay).mockResolvedValue(undefined);
    vi.mocked(db.codeBucket.updateMany).mockResolvedValue({ count: 1 } as any);

    await processor(dataWithRootPath);

    expect(codeWorkspaceClient.createBucketFromGithub).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/'
      })
    );
  });

  it('should handle different Git refs', async () => {
    const dataWithDevelopRef = {
      ...mockData,
      ref: 'develop'
    };

    vi.mocked(db.scmRepo.findFirstOrThrow).mockResolvedValue(mockRepoWithInstallation as any);
    vi.mocked(codeWorkspaceClient.createBucketFromGithub).mockResolvedValue({} as any);
    vi.mocked(delay).mockResolvedValue(undefined);
    vi.mocked(db.codeBucket.updateMany).mockResolvedValue({ count: 1 } as any);

    await processor(dataWithDevelopRef);

    expect(codeWorkspaceClient.createBucketFromGithub).toHaveBeenCalledWith(
      expect.objectContaining({
        ref: 'develop'
      })
    );
  });

  it('should handle repository not found error', async () => {
    vi.mocked(db.scmRepo.findFirstOrThrow).mockRejectedValue(
      new Error('Repository not found')
    );

    await expect(processor(mockData)).rejects.toThrow(
      'Repository not found'
    );

    expect(codeWorkspaceClient.createBucketFromGithub).not.toHaveBeenCalled();
    expect(db.codeBucket.updateMany).not.toHaveBeenCalled();
  });

  it('should handle GitHub API errors', async () => {
    vi.mocked(db.scmRepo.findFirstOrThrow).mockResolvedValue(mockRepoWithInstallation as any);
    vi.mocked(codeWorkspaceClient.createBucketFromGithub).mockRejectedValue(
      new Error('GitHub API error: Repository not accessible')
    );

    await expect(processor(mockData)).rejects.toThrow(
      'GitHub API error: Repository not accessible'
    );

    expect(db.codeBucket.updateMany).not.toHaveBeenCalled();
  });

  it('should delay before updating bucket status', async () => {
    vi.mocked(db.scmRepo.findFirstOrThrow).mockResolvedValue(mockRepoWithInstallation as any);
    vi.mocked(codeWorkspaceClient.createBucketFromGithub).mockResolvedValue({} as any);
    vi.mocked(delay).mockResolvedValue(undefined);
    vi.mocked(db.codeBucket.updateMany).mockResolvedValue({ count: 1 } as any);

    await processor(mockData);

    // Verify delay was called after createBucketFromGithub
    expect(delay).toHaveBeenCalled();
    const createCallOrder = vi.mocked(codeWorkspaceClient.createBucketFromGithub).mock.invocationCallOrder[0];
    const delayCallOrder = vi.mocked(delay).mock.invocationCallOrder[0];
    expect(delayCallOrder).toBeGreaterThan(createCallOrder);

    // Verify update was called after delay
    const updateCallOrder = vi.mocked(db.codeBucket.updateMany).mock.invocationCallOrder[0];
    expect(updateCallOrder).toBeGreaterThan(delayCallOrder);
  });

  it('should use correct access token from installation', async () => {
    const repoWithDifferentToken = {
      ...mockRepoWithInstallation,
      installation: {
        accessToken: 'different_token_456'
      }
    };

    vi.mocked(db.scmRepo.findFirstOrThrow).mockResolvedValue(repoWithDifferentToken as any);
    vi.mocked(codeWorkspaceClient.createBucketFromGithub).mockResolvedValue({} as any);
    vi.mocked(delay).mockResolvedValue(undefined);
    vi.mocked(db.codeBucket.updateMany).mockResolvedValue({ count: 1 } as any);

    await processor(mockData);

    expect(codeWorkspaceClient.createBucketFromGithub).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'different_token_456'
      })
    );
  });

  it('should handle missing installation gracefully', async () => {
    const repoWithoutInstallation = {
      ...mockRepoWithInstallation,
      installation: null
    };

    vi.mocked(db.scmRepo.findFirstOrThrow).mockResolvedValue(repoWithoutInstallation as any);

    // This should throw because installation.accessToken will be undefined
    await expect(processor(mockData)).rejects.toThrow();
  });

  it('should handle different owner and repo combinations', async () => {
    const customData = {
      ...mockData,
      owner: 'anotherorg',
      repo: 'anotherrepo'
    };

    vi.mocked(db.scmRepo.findFirstOrThrow).mockResolvedValue(mockRepoWithInstallation as any);
    vi.mocked(codeWorkspaceClient.createBucketFromGithub).mockResolvedValue({} as any);
    vi.mocked(delay).mockResolvedValue(undefined);
    vi.mocked(db.codeBucket.updateMany).mockResolvedValue({ count: 1 } as any);

    await processor(customData);

    expect(codeWorkspaceClient.createBucketFromGithub).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'anotherorg',
        repo: 'anotherrepo'
      })
    );
  });

  it('should update bucket status to ready after successful import', async () => {
    vi.mocked(db.scmRepo.findFirstOrThrow).mockResolvedValue(mockRepoWithInstallation as any);
    vi.mocked(codeWorkspaceClient.createBucketFromGithub).mockResolvedValue({} as any);
    vi.mocked(delay).mockResolvedValue(undefined);
    vi.mocked(db.codeBucket.updateMany).mockResolvedValue({ count: 1 } as any);

    await processor(mockData);

    expect(db.codeBucket.updateMany).toHaveBeenCalledWith({
      where: { id: 'bucket_123' },
      data: { status: 'ready' }
    });
  });

  it('should handle commit SHA as ref', async () => {
    const dataWithCommitSha = {
      ...mockData,
      ref: 'a1b2c3d4e5f6g7h8i9j0'
    };

    vi.mocked(db.scmRepo.findFirstOrThrow).mockResolvedValue(mockRepoWithInstallation as any);
    vi.mocked(codeWorkspaceClient.createBucketFromGithub).mockResolvedValue({} as any);
    vi.mocked(delay).mockResolvedValue(undefined);
    vi.mocked(db.codeBucket.updateMany).mockResolvedValue({ count: 1 } as any);

    await processor(dataWithCommitSha);

    expect(codeWorkspaceClient.createBucketFromGithub).toHaveBeenCalledWith(
      expect.objectContaining({
        ref: 'a1b2c3d4e5f6g7h8i9j0'
      })
    );
  });
});
