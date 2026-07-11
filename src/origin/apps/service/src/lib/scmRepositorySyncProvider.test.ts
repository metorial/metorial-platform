import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGitLabClientWithToken } from './gitlab';
import {
  createRepositorySyncBranch,
  getRepositorySyncCiState,
  mergeRepositorySyncPullRequest
} from './scmRepositorySyncProvider';

vi.mock('./gitlab', () => ({
  createGitLabClientWithToken: vi.fn()
}));

vi.mock('./githubApp', () => ({
  createGitHubInstallationClient: vi.fn()
}));

let createGitLabClient = vi.mocked(createGitLabClientWithToken);

let createSync = () =>
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
    }
  }) as any;

describe('GitLab repository sync', () => {
  let gitlab: any;

  beforeEach(() => {
    gitlab = {
      Branches: {
        create: vi.fn(),
        show: vi.fn(),
        remove: vi.fn()
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
    createGitLabClient.mockReturnValue(gitlab);
  });

  it.each([{ response: { status: 400 } }, { cause: { response: { statusCode: 409 } } }])(
    'reuses a verified branch when GitLab reports it already exists',
    async error => {
      gitlab.Branches.create.mockRejectedValue(error);
      gitlab.Branches.show.mockResolvedValue({ name: 'metorial/sync-marketplace-8' });

      await createRepositorySyncBranch(createSync());

      expect(gitlab.Branches.show).toHaveBeenCalledWith(123, 'metorial/sync-marketplace-8');
    }
  );

  it('propagates non-conflict branch creation failures', async () => {
    let error = { cause: { response: { statusCode: 403 } } };
    gitlab.Branches.create.mockRejectedValue(error);

    await expect(createRepositorySyncBranch(createSync())).rejects.toBe(error);
    expect(gitlab.Branches.show).not.toHaveBeenCalled();
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
