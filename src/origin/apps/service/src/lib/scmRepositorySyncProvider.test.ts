import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBitbucketClientWithInstallation } from './bitbucket';
import { createGitLabClientWithInstallation } from './gitlab';
import { createGitHubInstallationClient } from './githubApp';
import {
  closeRepositorySyncPullRequest,
  createRepositorySyncBranch,
  getRepositorySyncCiState,
  getRepositorySyncStatusSnapshot,
  mergeRepositorySyncPullRequest,
  prepareRepositorySyncDefaultBranch
} from './scmRepositorySyncProvider';

vi.mock('./gitlab', () => ({
  createGitLabClientWithInstallation: vi.fn()
}));

vi.mock('./githubApp', () => ({
  createGitHubInstallationClient: vi.fn()
}));

vi.mock('./bitbucket', () => ({
  createBitbucketClientWithInstallation: vi.fn()
}));

let createGitLabClient = vi.mocked(createGitLabClientWithInstallation);
let createGitHubClient = vi.mocked(createGitHubInstallationClient);
let createBitbucketClient = vi.mocked(createBitbucketClientWithInstallation);

let createSync = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'sync_123',
    branchName: 'metorial/sync-marketplace-8',
    baseBranch: 'main',
    providerPrId: '42',
    providerPrUrl: 'https://gitlab.example/project/-/merge_requests/42',
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
        edit: vi.fn(),
        merge: vi.fn(),
        show: vi.fn().mockResolvedValue({
          state: 'opened',
          sha: 'source_sha'
        })
      },
      Pipelines: {
        all: vi.fn()
      },
      MergeRequestApprovals: {
        showConfiguration: vi.fn(),
        showApprovalState: vi.fn()
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

  it('refreshes and prepares the live GitLab default branch for direct pushes', async () => {
    gitlab.Projects.show.mockResolvedValue({ default_branch: 'trunk', empty_repo: false });
    gitlab.Branches.show.mockImplementation(async (_projectId: number, branchName: string) => {
      if (branchName === 'trunk') return { name: branchName, commit: { id: 'trunk_sha' } };
      throw { cause: { response: { statusCode: 404 } } };
    });

    await expect(prepareRepositorySyncDefaultBranch(createSync())).resolves.toEqual({
      baseBranch: 'trunk'
    });
    expect(gitlab.Branches.show).toHaveBeenCalledWith(123, 'trunk');
    expect(gitlab.RepositoryFiles.create).not.toHaveBeenCalled();
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
      data: {
        code: 'bad_request',
        message: expect.stringContaining('a protected branch rule blocked the request')
      }
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
      message: expect.stringContaining('the integration lacks permission')
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
      sha: 'source_sha',
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

  it('normalizes GitLab checks, approvals, and mergeability into a provider-neutral snapshot', async () => {
    gitlab.Pipelines.all.mockResolvedValue([{ id: 1, status: 'success' }]);
    gitlab.MergeRequests.show.mockResolvedValue({
      state: 'opened',
      detailed_merge_status: 'not_approved'
    });
    gitlab.MergeRequestApprovals.showConfiguration.mockResolvedValue({
      approvals_required: 2,
      approved_by: [{ user: { id: 1 } }]
    });
    gitlab.MergeRequestApprovals.showApprovalState.mockResolvedValue({
      rules: [{ approvals_required: 2, approved: false, approved_by: [{ id: 1 }] }]
    });

    await expect(getRepositorySyncStatusSnapshot(createSync())).resolves.toMatchObject({
      version: 1,
      provider: 'gitlab',
      pullRequest: { id: '42', state: 'open' },
      checks: {
        state: 'success',
        total: 1,
        successful: 1,
        pending: 0,
        failed: 0,
        items: [
          {
            name: 'Pipeline 1',
            status: 'success',
            url: null,
            summary: 'Pipeline is success.'
          }
        ]
      },
      review: { state: 'pending', approvals: 1, requiredApprovals: 2 },
      mergeability: { state: 'blocked', reason: 'not_approved' }
    });
    expect(gitlab.MergeRequestApprovals.showConfiguration).toHaveBeenCalledWith(123, {
      mergerequestIId: 42
    });
    expect(gitlab.MergeRequestApprovals.showApprovalState).toHaveBeenCalledWith(123, 42);
  });

  it('keeps a GitLab pipeline waiting for manual jobs in a pending state', async () => {
    gitlab.Pipelines.all.mockResolvedValue([{ id: 1, status: 'manual' }]);
    gitlab.MergeRequests.show.mockResolvedValue({
      state: 'opened',
      detailed_merge_status: 'mergeable'
    });

    await expect(getRepositorySyncStatusSnapshot(createSync())).resolves.toMatchObject({
      checks: {
        state: 'pending',
        pending: 1,
        items: [{ status: 'pending', summary: 'Pipeline is manual.' }]
      }
    });
  });

  it('retries transient GitLab approval API failures instead of merging blindly', async () => {
    gitlab.Pipelines.all.mockResolvedValue([{ id: 1, status: 'success' }]);
    gitlab.MergeRequests.show.mockResolvedValue({
      state: 'opened',
      detailed_merge_status: 'mergeable'
    });
    gitlab.MergeRequestApprovals.showConfiguration.mockRejectedValue({
      cause: { response: { statusCode: 500 } }
    });

    await expect(getRepositorySyncStatusSnapshot(createSync())).rejects.toMatchObject({
      cause: { response: { statusCode: 500 } }
    });
  });

  it('treats a 405 as success when GitLab already merged the merge request', async () => {
    gitlab.MergeRequests.merge.mockRejectedValue({ cause: { response: { statusCode: 405 } } });
    gitlab.MergeRequests.show
      .mockResolvedValueOnce({ state: 'opened', sha: 'source_sha' })
      .mockResolvedValueOnce({
        state: 'merged',
        merge_commit_sha: 'merge_sha'
      });

    await expect(mergeRepositorySyncPullRequest(createSync())).resolves.toEqual({
      mergeSha: 'merge_sha'
    });
  });

  it('closes a superseded open GitLab merge request', async () => {
    gitlab.MergeRequests.show.mockResolvedValue({ state: 'opened' });

    await expect(closeRepositorySyncPullRequest(createSync())).resolves.toBe('closed');
    expect(gitlab.MergeRequests.edit).toHaveBeenCalledWith(123, 42, {
      stateEvent: 'close'
    });
  });

  it('preserves a superseded merge request that was already merged', async () => {
    gitlab.MergeRequests.show.mockResolvedValue({ state: 'merged' });

    await expect(closeRepositorySyncPullRequest(createSync())).resolves.toBe('merged');
    expect(gitlab.MergeRequests.edit).not.toHaveBeenCalled();
  });

  it('propagates merge failures', async () => {
    let error = new Error('merge rejected');
    gitlab.MergeRequests.merge.mockRejectedValue(error);

    await expect(mergeRepositorySyncPullRequest(createSync())).rejects.toBe(error);
  });

  it('marks GitLab merge permission failures as actionable', async () => {
    let error = Object.assign(new Error('401 Unauthorized'), { status: 401 });
    gitlab.MergeRequests.merge.mockRejectedValue(error);

    await expect(mergeRepositorySyncPullRequest(createSync())).rejects.toBe(error);
    expect((error as { scmMergePermissionDenied?: boolean }).scmMergePermissionDenied).toBe(
      true
    );
  });
});

describe('GitHub repository sync', () => {
  it('pins a merge to the current pull request source SHA', async () => {
    let request = vi.fn(async (route: string, input: Record<string, unknown>) => {
      if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}') {
        return {
          data: {
            merged: false,
            merge_commit_sha: null,
            head: { sha: 'source_sha' }
          }
        };
      }
      if (route === 'PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge') {
        expect(input).toMatchObject({ pull_number: 42, sha: 'source_sha' });
        return { data: { sha: 'merge_sha' } };
      }
      if (route === 'DELETE /repos/{owner}/{repo}/git/refs/{ref}') {
        return { data: {} };
      }
      throw new Error(`Unexpected GitHub route: ${route}`);
    });
    createGitHubClient.mockResolvedValue({ request } as any);

    await expect(
      mergeRepositorySyncPullRequest(
        createSync({
          providerPrUrl: 'https://github.com/metorial/skills/pull/42',
          repo: {
            id: 'repo_gh',
            provider: 'github',
            externalOwner: 'metorial',
            externalName: 'skills',
            installation: {
              externalInstallationId: '123',
              backend: {}
            }
          }
        })
      )
    ).resolves.toEqual({ mergeSha: 'merge_sha' });
  });
});

describe('direct push default branch preparation', () => {
  it('uses the live GitHub default branch', async () => {
    let request = vi.fn(async (route: string) => {
      if (route === 'GET /repos/{owner}/{repo}') return { data: { default_branch: 'trunk' } };
      if (route === 'GET /repos/{owner}/{repo}/git/ref/{ref}') {
        return { data: { object: { sha: 'trunk_sha' } } };
      }
      throw new Error(`Unexpected GitHub route: ${route}`);
    });
    createGitHubClient.mockResolvedValue({ request } as any);

    await expect(
      prepareRepositorySyncDefaultBranch(
        createSync({
          repo: {
            id: 'repo_gh',
            provider: 'github',
            externalOwner: 'metorial',
            externalName: 'skills',
            defaultBranch: 'main',
            installation: {
              externalInstallationId: '123',
              backend: {}
            }
          }
        })
      )
    ).resolves.toEqual({ baseBranch: 'trunk' });
  });

  it('uses the live Bitbucket default branch', async () => {
    let client = {
      getDefaultBranch: vi.fn().mockResolvedValue('trunk'),
      getBranch: vi.fn().mockResolvedValue('trunk_sha'),
      initializeRepository: vi.fn()
    };
    createBitbucketClient.mockResolvedValue(client as any);

    await expect(
      prepareRepositorySyncDefaultBranch(
        createSync({
          repo: {
            id: 'repo_bb',
            provider: 'bitbucket',
            externalId: 'metorial/skills',
            defaultBranch: 'main',
            installation: { backend: {} }
          }
        })
      )
    ).resolves.toEqual({ baseBranch: 'trunk' });
    expect(client.getBranch).toHaveBeenCalledWith('metorial/skills', 'trunk');
    expect(client.initializeRepository).not.toHaveBeenCalled();
  });
});
