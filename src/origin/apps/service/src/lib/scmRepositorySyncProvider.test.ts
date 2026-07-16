import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGitLabClientWithInstallation } from './gitlab';
import {
  createRepositorySyncBranch,
  getRepositorySyncCiState,
  mergeRepositorySyncPullRequest
} from './scmRepositorySyncProvider';

vi.mock('./gitlab', () => ({
  createGitLabClientWithInstallation: vi.fn()
}));

vi.mock('./githubApp', () => ({
  createGitHubInstallationClient: vi.fn()
}));

let createGitLabClient = vi.mocked(createGitLabClientWithInstallation);

let createSync = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'sync_123',
    branchName: 'metorial/sync-marketplace-8',
    baseBranch: 'main',
    providerPrId: '42',
    repo: {
      id: 'repo_123',
      provider: 'gitlab',
      externalId: '123',
      installation: {
        accessToken: 'token',
        backend: {}
      }
    },
    ...overrides
  }) as any;

describe('GitLab repository sync', () => {
  let gitlab: any;
  let createdBranches: Set<string>;

  beforeEach(() => {
    createdBranches = new Set();
    gitlab = {
      Branches: {
        create: vi.fn(async (_projectId: number, branchName: string) => {
          createdBranches.add(branchName);
          return { name: branchName, commit: { id: 'base_sha' } };
        }),
        show: vi.fn(async (_projectId: number, branchName: string) => {
          if (branchName === 'main' || branchName === 'master') {
            return { name: branchName, commit: { id: 'base_sha' } };
          }
          if (createdBranches.has(branchName)) {
            return { name: branchName, commit: { id: 'base_sha' } };
          }
          throw { cause: { response: { statusCode: 404 } } };
        }),
        remove: vi.fn()
      },
      Projects: {
        show: vi.fn().mockResolvedValue({ default_branch: 'main', empty_repo: false })
      },
      RepositoryFiles: {
        create: vi.fn()
      },
      MergeRequests: {
        merge: vi.fn(),
        show: vi.fn()
      },
      Pipelines: {
        all: vi.fn()
      }
    };
    createGitLabClient.mockReset();
    createGitLabClient.mockResolvedValue(gitlab);
  });

  it('creates and verifies a GitLab update branch', async () => {
    await expect(createRepositorySyncBranch(createSync())).resolves.toEqual({
      baseBranch: 'main'
    });

    expect(gitlab.Branches.create).toHaveBeenCalledWith(
      123,
      'metorial/sync-marketplace-8',
      'main'
    );
    expect(gitlab.Branches.show).toHaveBeenCalledWith(123, 'metorial/sync-marketplace-8');
  });

  it('reuses an existing update branch only when it still matches the base', async () => {
    createdBranches.add('metorial/sync-marketplace-8');

    await expect(createRepositorySyncBranch(createSync())).resolves.toEqual({
      baseBranch: 'main'
    });
    expect(gitlab.Branches.create).not.toHaveBeenCalled();
  });

  it('rejects an existing update branch that has diverged from the base', async () => {
    createdBranches.add('metorial/sync-marketplace-8');
    gitlab.Branches.show.mockImplementation(async (_projectId: number, branchName: string) => {
      if (branchName === 'main') return { name: 'main', commit: { id: 'base_sha' } };
      return { name: branchName, commit: { id: 'different_sha' } };
    });

    await expect(createRepositorySyncBranch(createSync())).rejects.toMatchObject({
      data: { code: 'conflict' }
    });
    expect(gitlab.Branches.create).not.toHaveBeenCalled();
  });

  it('preserves the original GitLab branch creation error instead of replacing it with a 404', async () => {
    let error = {
      cause: {
        description: 'Cannot create branch because it is protected',
        request: {
          method: 'POST',
          url: 'https://gitlab.com/api/v4/projects/123/repository/branches?token=secret'
        },
        response: { statusCode: 400 }
      }
    };
    gitlab.Branches.create.mockRejectedValue(error);

    await expect(createRepositorySyncBranch(createSync())).rejects.toMatchObject({
      data: { code: 'bad_request' },
      message: expect.stringContaining('Cannot create branch because it is protected')
    });
  });

  it('returns detailed permission guidance without a JavaScript stack trace', async () => {
    let error = {
      stack: 'GitbeakerRequestError: 403 Forbidden\n at secret.js:1:1',
      cause: {
        description: '403 Forbidden',
        request: {
          method: 'POST',
          url: 'https://gitlab.com/api/v4/projects/123/repository/branches'
        },
        response: { statusCode: 403 }
      }
    };
    gitlab.Branches.create.mockRejectedValue(error);

    let result = createRepositorySyncBranch(createSync());
    await expect(result).rejects.toMatchObject({
      data: { code: 'forbidden' },
      message: expect.stringContaining('HTTP status: 403')
    });
    await expect(result).rejects.not.toMatchObject({
      message: expect.stringContaining('secret.js')
    });
  });

  it('initializes an existing empty GitLab repository before creating the update branch', async () => {
    gitlab.Projects.show.mockResolvedValue({ default_branch: null, empty_repo: true });
    gitlab.RepositoryFiles.create.mockImplementation(
      async (_projectId: number, _path: string, branchName: string) => {
        createdBranches.add(branchName);
      }
    );

    await expect(
      createRepositorySyncBranch(createSync({ baseBranch: 'master' }))
    ).resolves.toEqual({ baseBranch: 'master' });

    expect(gitlab.RepositoryFiles.create).toHaveBeenCalledWith(
      123,
      '.gitignore',
      'master',
      '\n',
      'Initialize repository'
    );
    expect(gitlab.Branches.create).toHaveBeenCalledWith(
      123,
      'metorial/sync-marketplace-8',
      'master'
    );
  });

  it('continues when an empty repository is initialized concurrently', async () => {
    gitlab.Projects.show.mockResolvedValue({ default_branch: null, empty_repo: true });
    gitlab.RepositoryFiles.create.mockImplementation(async () => {
      createdBranches.add('main');
      throw { cause: { description: 'A file already exists', response: { statusCode: 400 } } };
    });

    await expect(createRepositorySyncBranch(createSync())).resolves.toEqual({
      baseBranch: 'main'
    });
  });

  it('uses the live GitLab default branch when the cached branch is stale', async () => {
    gitlab.Projects.show.mockResolvedValue({ default_branch: 'main', empty_repo: false });

    await expect(
      createRepositorySyncBranch(createSync({ baseBranch: 'master' }))
    ).resolves.toEqual({ baseBranch: 'main' });
    expect(gitlab.Branches.create).toHaveBeenCalledWith(
      123,
      'metorial/sync-marketplace-8',
      'main'
    );
  });

  it('recovers from a transient create failure without duplicating the branch', async () => {
    gitlab.Branches.create
      .mockRejectedValueOnce({ cause: { response: { statusCode: 500 } } })
      .mockImplementationOnce(async (_projectId: number, branchName: string) => {
        createdBranches.add(branchName);
      });

    await expect(createRepositorySyncBranch(createSync())).resolves.toEqual({
      baseBranch: 'main'
    });
    expect(gitlab.Branches.create).toHaveBeenCalledTimes(2);
  });

  it('passes slash-containing branch names to GitBeaker without pre-encoding', async () => {
    let branchName = 'metorial/sync/marketplace-8';
    await createRepositorySyncBranch(createSync({ branchName }));

    expect(gitlab.Branches.create).toHaveBeenCalledWith(123, branchName, 'main');
  });

  it('lets GitLab remove the source branch during merge without deleting it again', async () => {
    gitlab.MergeRequests.merge.mockResolvedValue({ merge_commit_sha: 'merge_sha' });

    await expect(mergeRepositorySyncPullRequest(createSync())).resolves.toEqual({
      mergeSha: 'merge_sha'
    });

    expect(gitlab.MergeRequests.merge).toHaveBeenCalledWith(123, 42, {
      shouldRemoveSourceBranch: true
    });
    expect(gitlab.Branches.remove).not.toHaveBeenCalled();
  });

  it('waits for GitLab to finish checking mergeability', async () => {
    gitlab.Pipelines.all.mockResolvedValue([]);
    gitlab.MergeRequests.show.mockResolvedValue({
      state: 'opened',
      detailed_merge_status: 'checking'
    });

    await expect(getRepositorySyncCiState(createSync())).resolves.toBe('pending');
  });

  it('allows a merge only when GitLab reports the merge request is mergeable', async () => {
    gitlab.Pipelines.all.mockResolvedValue([{ id: 1, status: 'success' }]);
    gitlab.MergeRequests.show.mockResolvedValue({
      state: 'opened',
      detailed_merge_status: 'mergeable'
    });

    await expect(getRepositorySyncCiState(createSync())).resolves.toBe('success');
  });

  it('treats a 405 as success when GitLab already merged the merge request', async () => {
    gitlab.MergeRequests.merge.mockRejectedValue({ cause: { response: { statusCode: 405 } } });
    gitlab.MergeRequests.show.mockResolvedValue({
      state: 'merged',
      merge_commit_sha: 'merge_sha'
    });

    await expect(mergeRepositorySyncPullRequest(createSync())).resolves.toEqual({
      mergeSha: 'merge_sha'
    });
  });

  it('propagates merge failures', async () => {
    let error = new Error('merge rejected');
    gitlab.MergeRequests.merge.mockRejectedValue(error);

    await expect(mergeRepositorySyncPullRequest(createSync())).rejects.toBe(error);
  });
});
