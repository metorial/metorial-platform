import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBitbucketClientWithInstallation } from './bitbucket';
import { createGitLabClientWithInstallation } from './gitlab';
import { createGitHubInstallationClient } from './githubApp';
import {
  closeRepositorySyncPullRequest,
  compareRepositorySyncBranchContents,
  deleteRepositorySyncBranch,
  getRepositorySyncDismissal,
  getRepositorySyncPullRequestState,
  resetRepositorySyncBranch,
  updateRepositorySyncPullRequest
} from './scmRepositorySyncProvider';

vi.mock('./gitlab', () => ({ createGitLabClientWithInstallation: vi.fn() }));
vi.mock('./githubApp', () => ({ createGitHubInstallationClient: vi.fn() }));
vi.mock('./bitbucket', () => ({ createBitbucketClientWithInstallation: vi.fn() }));

let createGitLabClient = vi.mocked(createGitLabClientWithInstallation);
let createGitHubClient = vi.mocked(createGitHubInstallationClient);
let createBitbucketClient = vi.mocked(createBitbucketClientWithInstallation);

let notFound = { status: 404 };
let gitlabNotFound = { cause: { response: { statusCode: 404 } } };

let createSync = (provider: string, overrides: Record<string, unknown> = {}) =>
  ({
    id: 'sync_1',
    title: 'Update skills',
    description: 'New skill files',
    branchName: 'metorial/skills-1',
    baseBranch: 'main',
    providerPrId: '42',
    providerPrUrl: 'https://example.test/pr/42',
    repo: {
      id: 'repo_1',
      provider,
      externalId: '123',
      externalOwner: 'acme',
      externalName: 'skills',
      installation: { accessToken: 'token', externalInstallationId: '7', backend: {} }
    },
    ...overrides
  }) as any;

describe('GitHub lane helpers', () => {
  let request: ReturnType<typeof vi.fn>;
  let routes: Record<string, unknown>;

  beforeEach(() => {
    routes = {};
    request = vi.fn(async (route: string, params: any) => {
      let key = route.startsWith('GET /repos/{owner}/{repo}/git/ref/')
        ? `${route}:${params.ref}`
        : route;
      let value = routes[key];
      if (
        value instanceof Error ||
        (value && typeof value === 'object' && 'status' in value)
      ) {
        throw value;
      }
      if (typeof value === 'function') return value(params);
      return { data: value ?? {} };
    });
    createGitHubClient.mockReset();
    createGitHubClient.mockResolvedValue({ request } as any);
  });

  it.each([
    [
      { state: 'open', merged: false, mergeable: true },
      { state: 'open', conflicting: false }
    ],
    [
      { state: 'open', merged: false, mergeable: false },
      { state: 'open', conflicting: true }
    ],
    [
      { state: 'open', merged: false, mergeable: null },
      { state: 'open', conflicting: false }
    ],
    [
      { state: 'closed', merged: true },
      { state: 'merged', conflicting: false }
    ],
    [
      { state: 'closed', merged: false },
      { state: 'closed', conflicting: false }
    ]
  ])('maps PR %o to %o', async (pr, expected) => {
    routes['GET /repos/{owner}/{repo}/pulls/{pull_number}'] = pr;
    await expect(getRepositorySyncPullRequestState(createSync('github'))).resolves.toEqual(
      expected
    );
  });

  it('maps a deleted PR to missing and returns null without a PR', async () => {
    routes['GET /repos/{owner}/{repo}/pulls/{pull_number}'] = notFound;
    await expect(getRepositorySyncPullRequestState(createSync('github'))).resolves.toEqual({
      state: 'missing',
      conflicting: false
    });
    await expect(
      getRepositorySyncPullRequestState(createSync('github', { providerPrId: null }))
    ).resolves.toBeNull();
  });

  it('reports branch deletion before PR closure', async () => {
    routes['GET /repos/{owner}/{repo}/git/ref/{ref}:heads/metorial/skills-1'] = notFound;
    await expect(
      getRepositorySyncDismissal(createSync('github'), { state: 'closed', conflicting: false })
    ).resolves.toBe('branch_deleted');

    routes['GET /repos/{owner}/{repo}/git/ref/{ref}:heads/metorial/skills-1'] = {
      object: { sha: 'head' }
    };
    await expect(
      getRepositorySyncDismissal(createSync('github'), { state: 'closed', conflicting: false })
    ).resolves.toBe('pull_request_closed');
    await expect(
      getRepositorySyncDismissal(createSync('github'), {
        state: 'missing',
        conflicting: false
      })
    ).resolves.toBe('pull_request_deleted');
    await expect(
      getRepositorySyncDismissal(createSync('github'), { state: 'open', conflicting: false })
    ).resolves.toBeNull();
    await expect(
      getRepositorySyncDismissal(createSync('github'), { state: 'merged', conflicting: false })
    ).resolves.toBeNull();
  });

  it('comments before closing a replaced PR', async () => {
    routes['GET /repos/{owner}/{repo}/pulls/{pull_number}'] = { state: 'open', merged: false };

    await expect(
      closeRepositorySyncPullRequest(createSync('github'), { comment: 'Continued in #43' })
    ).resolves.toBe('closed');

    let calls = request.mock.calls.map(call => call[0]);
    expect(calls).toEqual([
      'GET /repos/{owner}/{repo}/pulls/{pull_number}',
      'POST /repos/{owner}/{repo}/issues/{issue_number}/comments',
      'PATCH /repos/{owner}/{repo}/pulls/{pull_number}'
    ]);
    expect(request.mock.calls[1]![1]).toMatchObject({
      issue_number: 42,
      body: 'Continued in #43'
    });
  });

  it('updates the adopted PR title and description', async () => {
    routes['PATCH /repos/{owner}/{repo}/pulls/{pull_number}'] = { head: { sha: 'head' } };
    await updateRepositorySyncPullRequest(createSync('github'));

    expect(request).toHaveBeenCalledWith(
      'PATCH /repos/{owner}/{repo}/pulls/{pull_number}',
      expect.objectContaining({
        pull_number: 42,
        title: 'Update skills',
        body: 'New skill files'
      })
    );
  });

  describe('resetting a branch', () => {
    let ref: { sha: string };
    let graphql: ReturnType<typeof vi.fn>;
    let branchRoute = 'GET /repos/{owner}/{repo}/git/ref/{ref}:heads/metorial/skills-1';

    let reset = () =>
      resetRepositorySyncBranch(createSync('github'), {
        expectedSha: 'metorial_head',
        baseSha: 'base_head'
      });

    beforeEach(() => {
      ref = { sha: 'metorial_head' };
      routes['GET /repos/{owner}/{repo}'] = { node_id: 'R_repo' };
      routes['GET /repos/{owner}/{repo}/git/commits/{commit_sha}'] = {
        tree: { sha: 'base_tree' }
      };
      routes['POST /repos/{owner}/{repo}/git/commits'] = { sha: 'reset_commit' };
      routes[branchRoute] = () => ({ data: { object: { sha: ref.sha } } });
      graphql = vi.fn(async (_query: string, { input }: any) => {
        let [update] = input.refUpdates;
        if (update.beforeOid !== ref.sha) {
          throw Object.assign(new Error('Request failed due to following response errors'), {
            errors: [{ type: 'UNPROCESSABLE', message: 'Reference has moved' }]
          });
        }
        ref.sha = update.afterOid;
        return { updateRefs: { clientMutationId: null } };
      });
      createGitHubClient.mockResolvedValue({ request, graphql } as any);
    });

    it('swaps the branch to an empty commit on top of base', async () => {
      await expect(reset()).resolves.toEqual({ status: 'reset', sha: 'reset_commit' });

      expect(request).toHaveBeenCalledWith(
        'POST /repos/{owner}/{repo}/git/commits',
        expect.objectContaining({ tree: 'base_tree', parents: ['base_head'] })
      );
      expect(graphql).toHaveBeenCalledWith(expect.stringContaining('updateRefs'), {
        input: {
          repositoryId: 'R_repo',
          refUpdates: [
            {
              name: 'refs/heads/metorial/skills-1',
              beforeOid: 'metorial_head',
              afterOid: 'reset_commit',
              force: true
            }
          ]
        }
      });
      expect(ref.sha).toBe('reset_commit');
      expect(request).not.toHaveBeenCalledWith(
        'PATCH /repos/{owner}/{repo}/git/refs/{ref}',
        expect.anything()
      );
    });

    it('keeps a push that lands between inspecting and moving the branch', async () => {
      routes['POST /repos/{owner}/{repo}/git/commits'] = () => {
        ref.sha = 'reviewer_push';
        return { data: { sha: 'reset_commit' } };
      };

      await expect(reset()).resolves.toEqual({ status: 'moved' });
      expect(ref.sha).toBe('reviewer_push');
    });

    it('refuses a branch that already moved', async () => {
      ref.sha = 'someone_else';

      await expect(reset()).resolves.toEqual({ status: 'moved' });
      expect(ref.sha).toBe('someone_else');
    });

    it('falls back when the server has no compare-and-swap mutation', async () => {
      graphql.mockRejectedValue(
        Object.assign(new Error('GraphQL error'), {
          errors: [
            {
              message: "Field 'updateRefs' doesn't exist on type 'Mutation'",
              extensions: { code: 'undefinedField' }
            }
          ]
        })
      );

      await expect(reset()).resolves.toEqual({ status: 'unsupported' });
      expect(ref.sha).toBe('metorial_head');
    });

    it('reports a rejected swap that left the branch alone', async () => {
      graphql.mockRejectedValue(
        Object.assign(new Error('Forbidden'), {
          errors: [{ type: 'FORBIDDEN', message: 'Resource not accessible by integration' }]
        })
      );

      await expect(reset()).resolves.toEqual({ status: 'rejected' });
      expect(ref.sha).toBe('metorial_head');
    });

    it('retries a swap whose outcome is unknown', async () => {
      graphql.mockRejectedValue(Object.assign(new Error('Bad gateway'), { status: 502 }));

      await expect(reset()).rejects.toThrow('reset the update branch');
      expect(ref.sha).toBe('metorial_head');
    });

    it('does not reset on providers without a compare-and-swap ref update', async () => {
      await expect(
        resetRepositorySyncBranch(createSync('gitlab'), {
          expectedSha: 'metorial_head',
          baseSha: 'base_head'
        })
      ).resolves.toEqual({ status: 'unsupported' });
      expect(createGitHubClient).not.toHaveBeenCalled();
    });
  });

  it.each([
    ['tree_same', true],
    ['tree_other', false]
  ])('compares branch trees rather than commits (%s)', async (branchTree, identical) => {
    routes['GET /repos/{owner}/{repo}/branches/{branch}'] = (params: any) => ({
      data:
        params.branch === 'main'
          ? { commit: { sha: 'base_head', commit: { tree: { sha: 'tree_same' } } } }
          : { commit: { sha: 'metorial_head', commit: { tree: { sha: branchTree } } } }
    });

    await expect(compareRepositorySyncBranchContents(createSync('github'))).resolves.toEqual({
      identical,
      baseSha: 'base_head',
      branchSha: 'metorial_head'
    });
  });

  it('deletes the sync branch, tolerating one that is already gone', async () => {
    await deleteRepositorySyncBranch(createSync('github'));
    expect(request).toHaveBeenCalledWith('DELETE /repos/{owner}/{repo}/git/refs/{ref}', {
      owner: 'acme',
      repo: 'skills',
      ref: 'heads/metorial/skills-1'
    });

    routes['DELETE /repos/{owner}/{repo}/git/refs/{ref}'] = notFound;
    await expect(deleteRepositorySyncBranch(createSync('github'))).resolves.toBeUndefined();

    request.mockClear();
    await deleteRepositorySyncBranch(createSync('github', { branchName: 'main' }));
    expect(request).not.toHaveBeenCalled();
  });
});

describe('GitLab lane helpers', () => {
  let gitlab: any;

  beforeEach(() => {
    gitlab = {
      MergeRequests: { show: vi.fn(), edit: vi.fn() },
      MergeRequestNotes: { create: vi.fn() },
      Branches: { show: vi.fn(), remove: vi.fn() },
      Repositories: { compare: vi.fn() }
    };
    createGitLabClient.mockReset();
    createGitLabClient.mockResolvedValue(gitlab);
  });

  it.each([
    [
      { state: 'opened', has_conflicts: false },
      { state: 'open', conflicting: false }
    ],
    [
      { state: 'opened', has_conflicts: true },
      { state: 'open', conflicting: true }
    ],
    [
      { state: 'opened', detailed_merge_status: 'conflict' },
      { state: 'open', conflicting: true }
    ],
    [{ state: 'merged' }, { state: 'merged', conflicting: false }],
    [{ state: 'closed' }, { state: 'closed', conflicting: false }]
  ])('maps MR %o to %o', async (mergeRequest, expected) => {
    gitlab.MergeRequests.show.mockResolvedValue(mergeRequest);
    await expect(getRepositorySyncPullRequestState(createSync('gitlab'))).resolves.toEqual(
      expected
    );
  });

  it('maps a deleted MR to missing', async () => {
    gitlab.MergeRequests.show.mockRejectedValue(gitlabNotFound);
    await expect(getRepositorySyncPullRequestState(createSync('gitlab'))).resolves.toEqual({
      state: 'missing',
      conflicting: false
    });
  });

  it('detects an open MR whose source branch was deleted', async () => {
    gitlab.Branches.show.mockRejectedValue(gitlabNotFound);
    await expect(
      getRepositorySyncDismissal(createSync('gitlab'), { state: 'open', conflicting: false })
    ).resolves.toBe('branch_deleted');
  });

  it('comments, closes and updates merge requests', async () => {
    gitlab.MergeRequests.show.mockResolvedValue({ state: 'opened' });
    await closeRepositorySyncPullRequest(createSync('gitlab'), {
      comment: 'Continued in !43'
    });
    expect(gitlab.MergeRequestNotes.create).toHaveBeenCalledWith(123, 42, 'Continued in !43');
    expect(gitlab.MergeRequests.edit).toHaveBeenCalledWith(123, 42, { stateEvent: 'close' });

    await updateRepositorySyncPullRequest(createSync('gitlab'));
    expect(gitlab.MergeRequests.edit).toHaveBeenCalledWith(123, 42, {
      title: 'Update skills',
      description: 'New skill files'
    });
  });

  it('cannot reset branches without a git push transport', async () => {
    await expect(
      resetRepositorySyncBranch(createSync('gitlab'), { expectedSha: 'a', baseSha: 'b' })
    ).resolves.toEqual({ status: 'unsupported' });
  });
  it.each([
    [{ diffs: [], compare_timeout: false }, true],
    [{ diffs: [{ new_path: 'skill.md' }], compare_timeout: false }, false],
    [{ diffs: [], compare_timeout: true }, false]
  ])('compares branch contents with a straight diff (%o)', async (comparison, identical) => {
    gitlab.Branches.show.mockImplementation(async (_project: number, branch: string) => ({
      commit: { id: branch === 'main' ? 'base_head' : 'metorial_head' }
    }));
    gitlab.Repositories.compare.mockResolvedValue(comparison);

    await expect(compareRepositorySyncBranchContents(createSync('gitlab'))).resolves.toEqual({
      identical,
      baseSha: 'base_head',
      branchSha: 'metorial_head'
    });
    expect(gitlab.Repositories.compare).toHaveBeenCalledWith(
      123,
      'base_head',
      'metorial_head',
      { straight: true }
    );
  });

  it('skips the diff when both branches point at the same commit', async () => {
    gitlab.Branches.show.mockResolvedValue({ commit: { id: 'same' } });
    await expect(compareRepositorySyncBranchContents(createSync('gitlab'))).resolves.toEqual({
      identical: true,
      baseSha: 'same',
      branchSha: 'same'
    });
    expect(gitlab.Repositories.compare).not.toHaveBeenCalled();
  });

  it('deletes the sync branch, tolerating one that is already gone', async () => {
    await deleteRepositorySyncBranch(createSync('gitlab'));
    expect(gitlab.Branches.remove).toHaveBeenCalledWith(123, 'metorial/skills-1');

    gitlab.Branches.remove.mockRejectedValue(gitlabNotFound);
    await expect(deleteRepositorySyncBranch(createSync('gitlab'))).resolves.toBeUndefined();
  });
});

describe.each([
  ['Bitbucket Cloud', 'bitbucket'],
  ['Bitbucket Data Center', 'bitbucket_data_center']
])('%s lane helpers', (_label, backendType) => {
  let client: any;
  let sync = () =>
    createSync('bitbucket', {
      repo: {
        ...createSync('bitbucket').repo,
        installation: { accessToken: 'token', backend: { type: backendType } }
      }
    });

  beforeEach(() => {
    client = {
      getPullRequestStatus: vi.fn(),
      getBranch: vi.fn(),
      hasContentDifference: vi.fn(),
      deleteBranch: vi.fn(),
      commentOnPullRequest: vi.fn(),
      declinePullRequest: vi.fn(),
      updatePullRequest: vi.fn()
    };
    createBitbucketClient.mockReset();
    createBitbucketClient.mockResolvedValue(client);
  });

  it.each([
    [
      { state: 'OPEN', mergeability: 'mergeable' },
      { state: 'open', conflicting: false }
    ],
    [
      { state: 'OPEN', mergeability: 'conflicting' },
      { state: 'open', conflicting: true }
    ],
    [{ state: 'MERGED' }, { state: 'merged', conflicting: false }],
    [{ state: 'FULFILLED' }, { state: 'merged', conflicting: false }],
    [{ state: 'DECLINED' }, { state: 'closed', conflicting: false }]
  ])('maps PR %o to %o', async (pr, expected) => {
    client.getPullRequestStatus.mockResolvedValue(pr);
    await expect(getRepositorySyncPullRequestState(sync())).resolves.toEqual(expected);
  });

  it('maps a deleted PR and a deleted branch', async () => {
    client.getPullRequestStatus.mockRejectedValue(notFound);
    await expect(getRepositorySyncPullRequestState(sync())).resolves.toEqual({
      state: 'missing',
      conflicting: false
    });

    client.getBranch.mockRejectedValue(notFound);
    await expect(
      getRepositorySyncDismissal(sync(), { state: 'open', conflicting: false })
    ).resolves.toBe('branch_deleted');
  });

  it('comments before declining and updates the PR', async () => {
    client.getPullRequestStatus.mockResolvedValue({ state: 'OPEN' });
    await closeRepositorySyncPullRequest(sync(), { comment: 'Continued elsewhere' });
    expect(client.commentOnPullRequest).toHaveBeenCalledWith(
      '123',
      '42',
      'Continued elsewhere'
    );
    expect(client.declinePullRequest).toHaveBeenCalledWith('123', '42');
    expect(client.commentOnPullRequest.mock.invocationCallOrder[0]).toBeLessThan(
      client.declinePullRequest.mock.invocationCallOrder[0]
    );

    await updateRepositorySyncPullRequest(sync());
    expect(client.updatePullRequest).toHaveBeenCalledWith('123', '42', {
      title: 'Update skills',
      description: 'New skill files'
    });
  });

  it('cannot reset branches without a git push transport', async () => {
    await expect(
      resetRepositorySyncBranch(sync(), { expectedSha: 'a', baseSha: 'b' })
    ).resolves.toEqual({ status: 'unsupported' });
  });

  it.each([
    [false, true],
    [true, false]
  ])('compares branch contents (difference: %s)', async (difference, identical) => {
    client.getBranch.mockImplementation(async (_repo: string, branch: string) =>
      branch === 'main' ? 'base_head' : 'metorial_head'
    );
    client.hasContentDifference.mockResolvedValue(difference);

    await expect(compareRepositorySyncBranchContents(sync())).resolves.toEqual({
      identical,
      baseSha: 'base_head',
      branchSha: 'metorial_head'
    });
    expect(client.hasContentDifference).toHaveBeenCalledWith(
      '123',
      'base_head',
      'metorial_head'
    );
  });

  it('deletes the sync branch, tolerating one that is already gone', async () => {
    await deleteRepositorySyncBranch(sync());
    expect(client.deleteBranch).toHaveBeenCalledWith('123', 'metorial/skills-1');

    client.deleteBranch.mockRejectedValue(notFound);
    await expect(deleteRepositorySyncBranch(sync())).resolves.toBeUndefined();
  });
});
