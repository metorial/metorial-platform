import { badRequestError, conflictError, ServiceError } from '@lowerdeck/error';
import type {
  ScmBackend,
  ScmInstallation,
  ScmRepository,
  ScmRepositorySync
} from '../../prisma/generated/client';
import { createBitbucketClientWithInstallation } from './bitbucket';
import { createGitHubInstallationClient } from './githubApp';
import { createGitLabClientWithInstallation } from './gitlab';
import {
  getScmProviderErrorDetails,
  getScmProviderErrorStatus,
  isRetryableScmProviderError,
  wrapScmProviderError
} from './scmProviderError';
import type { RepositorySyncStatusSnapshot } from '../services/repositorySyncState';

type SyncWithRepo = ScmRepositorySync & {
  repo: ScmRepository & {
    installation: ScmInstallation & {
      backend: ScmBackend;
    };
  };
};

export type RepositorySyncCiState = 'pending' | 'success' | 'failed';
export type { RepositorySyncStatusSnapshot } from '../services/repositorySyncState';

let getGitHubClient = async (repo: SyncWithRepo['repo']) => {
  if (!repo.installation.externalInstallationId) {
    throw new ServiceError(badRequestError({ message: 'Installation ID not found' }));
  }

  return createGitHubInstallationClient(
    repo.installation.externalInstallationId,
    repo.installation.backend
  );
};

let getGitLabClient = async (repo: SyncWithRepo['repo']) =>
  createGitLabClientWithInstallation(repo.installation);

type GitLabClient = Awaited<ReturnType<typeof getGitLabClient>>;

type GitLabMergeRequestStatus = {
  state: string;
  detailed_merge_status?: string;
  detailedMergeStatus?: string;
  merge_status?: string;
  merge_error?: string | null;
  has_conflicts?: boolean;
  blocking_discussions_resolved?: boolean;
  draft?: boolean;
  merge_commit_sha?: string | null;
  squash_commit_sha?: string | null;
  sha?: string | null;
  diff_refs?: { head_sha?: string | null };
};

let getGitLabMergeRequest = async (
  gitlab: GitLabClient,
  projectId: number,
  mergeRequestIid: number
): Promise<GitLabMergeRequestStatus> =>
  (await gitlab.MergeRequests.show(projectId, mergeRequestIid, {
    withMergeStatusRecheck: true
  } as NonNullable<Parameters<GitLabClient['MergeRequests']['show']>[2]> & {
    withMergeStatusRecheck: boolean;
  })) as unknown as GitLabMergeRequestStatus;

let getBitbucketClient = async (repo: SyncWithRepo['repo']) =>
  createBitbucketClientWithInstallation(repo.installation);

let collectGitHubPages = async <T>(loadPage: (page: number) => Promise<T[]>) => {
  let items: T[] = [];
  for (let page = 1; ; page++) {
    let next = await loadPage(page);
    items.push(...next);
    if (next.length < 100) return items;
  }
};

let isGitHubEmptyRepositoryError = (e: any) =>
  e.status === 409 &&
  typeof e.message === 'string' &&
  e.message.toLowerCase().includes('git repository is empty');

let logGitHubSyncDebug = (message: string, d: Record<string, unknown>) => {
  void message;
  void d;
};

let logGitHubSyncError = (message: string, e: any, d: Record<string, unknown>) => {
  void message;
  void e;
  void d;
};

let logGitLabSyncDebug = (message: string, d: Record<string, unknown>) => {
  console.log(
    JSON.stringify({
      event: 'gitlab_repository_sync',
      level: 'info',
      message,
      ...d
    })
  );
};

let logGitLabSyncError = (message: string, e: any, d: Record<string, unknown>) => {
  console.log(
    JSON.stringify({
      event: 'gitlab_repository_sync',
      level: 'error',
      message,
      ...d,
      providerError: getScmProviderErrorDetails(e)
    })
  );
};

let normalizeGitLabBranch = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  let normalized = value.trim();
  if (!normalized || ['null', 'undefined'].includes(normalized.toLowerCase()))
    return undefined;
  return normalized;
};

let getGitLabProjectDefaultBranch = (project: any) =>
  normalizeGitLabBranch(project?.default_branch ?? project?.defaultBranch);

let gitLabDelay = (attempt: number) =>
  new Promise(resolve => setTimeout(resolve, attempt * 250));

let runRetryableGitLabRead = async <T>(operation: () => Promise<T>) => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableScmProviderError(error) || attempt === 3) throw error;
      await gitLabDelay(attempt);
    }
  }

  throw new Error('GitLab request retry loop exhausted');
};

let getGitLabBranchOrNull = async (gitlab: any, projectId: number, branchName: string) => {
  try {
    return await runRetryableGitLabRead(() => gitlab.Branches.show(projectId, branchName));
  } catch (error) {
    if (getScmProviderErrorStatus(error) === 404) return null;
    throw error;
  }
};

let waitForGitLabBranch = async (gitlab: any, projectId: number, branchName: string) => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    let branch = await getGitLabBranchOrNull(gitlab, projectId, branchName);
    if (branch) return branch;
    if (attempt < 3) await gitLabDelay(attempt);
  }

  return null;
};

let getGitLabBranchSha = (branch: any) => branch?.commit?.id ?? branch?.commit?.sha;

let assertGitLabSyncBranchIsSafe = (d: {
  branch: any;
  baseBranch: any;
  branchName: string;
  baseBranchName: string;
}) => {
  let branchSha = getGitLabBranchSha(d.branch);
  let baseSha = getGitLabBranchSha(d.baseBranch);
  if (branchSha && baseSha && branchSha === baseSha) return;

  throw new ServiceError(
    conflictError({
      message:
        `GitLab update branch "${d.branchName}" already exists and does not point to ` +
        `the current base branch "${d.baseBranchName}". Choose a new update branch or remove ` +
        'the existing branch before retrying.'
    })
  );
};

let initializeEmptyGitLabRepository = async (d: {
  gitlab: any;
  projectId: number;
  branchName: string;
  context: Record<string, unknown>;
  onLog?: (message: string) => Promise<void>;
}) => {
  await d.onLog?.(
    `GitLab repository is empty; initializing default branch "${d.branchName}".`
  );
  logGitLabSyncDebug('initializing empty repository', {
    ...d.context,
    baseBranch: d.branchName
  });

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await d.gitlab.RepositoryFiles.create(
        d.projectId,
        '.gitignore',
        d.branchName,
        '\n',
        'Initialize repository'
      );
    } catch (error) {
      let branch = await getGitLabBranchOrNull(d.gitlab, d.projectId, d.branchName);
      if (branch) {
        await d.onLog?.(
          `GitLab default branch "${d.branchName}" was initialized concurrently.`
        );
        return branch;
      }

      if (isRetryableScmProviderError(error) && attempt < 3) {
        await gitLabDelay(attempt);
        continue;
      }

      throw wrapScmProviderError('gitlab', error, 'initialize the empty repository', {
        context: {
          ...d.context,
          baseBranch: d.branchName
        },
        remediation:
          'Ensure the connected GitLab user can create commits and that no protected-branch rule blocks the default branch.'
      });
    }

    let branch = await waitForGitLabBranch(d.gitlab, d.projectId, d.branchName);
    if (branch) {
      await d.onLog?.(`Initialized GitLab default branch "${d.branchName}".`);
      return branch;
    }
  }

  throw new ServiceError(
    badRequestError({
      message:
        `GitLab accepted repository initialization but default branch "${d.branchName}" ` +
        'could not be verified. Retry the sync after GitLab finishes processing the initial commit.'
    })
  );
};

let initializeEmptyGitHubRepository = async (d: {
  octokit: Awaited<ReturnType<typeof getGitHubClient>>;
  repo: SyncWithRepo['repo'];
  branchName: string;
}) => {
  logGitHubSyncDebug('initializing empty repository', {
    repoId: d.repo.id,
    owner: d.repo.externalOwner,
    repo: d.repo.externalName,
    baseBranch: d.branchName
  });

  let init: Awaited<
    ReturnType<typeof d.octokit.request<'PUT /repos/{owner}/{repo}/contents/{path}'>>
  >;

  try {
    init = await d.octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
      owner: d.repo.externalOwner,
      repo: d.repo.externalName,
      path: '.gitignore',
      message: 'Initialize repository',
      content: Buffer.from('\n', 'utf-8').toString('base64'),
      branch: d.branchName
    });
  } catch (e: any) {
    logGitHubSyncError('failed to initialize empty repository with explicit branch', e, {
      repoId: d.repo.id,
      owner: d.repo.externalOwner,
      repo: d.repo.externalName,
      baseBranch: d.branchName
    });

    init = await d.octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
      owner: d.repo.externalOwner,
      repo: d.repo.externalName,
      path: '.gitignore',
      message: 'Initialize repository',
      content: Buffer.from('\n', 'utf-8').toString('base64')
    });
  }

  logGitHubSyncDebug('empty repository initialized with contents api', {
    repoId: d.repo.id,
    owner: d.repo.externalOwner,
    repo: d.repo.externalName,
    baseBranch: d.branchName,
    commitSha: init.data.commit.sha
  });

  let initCommitSha = init.data.commit.sha;
  if (!initCommitSha) {
    throw new ServiceError(
      badRequestError({ message: 'GitHub did not return an initial commit SHA' })
    );
  }

  try {
    let baseRef = await d.octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
      owner: d.repo.externalOwner,
      repo: d.repo.externalName,
      ref: `heads/${d.branchName}`
    });

    logGitHubSyncDebug('loaded initialized base ref', {
      repoId: d.repo.id,
      owner: d.repo.externalOwner,
      repo: d.repo.externalName,
      baseBranch: d.branchName,
      baseSha: baseRef.data.object.sha
    });

    return baseRef.data.object.sha;
  } catch (e: any) {
    logGitHubSyncError('failed to load base ref after contents api initialization', e, {
      repoId: d.repo.id,
      owner: d.repo.externalOwner,
      repo: d.repo.externalName,
      baseBranch: d.branchName,
      initCommitSha
    });

    try {
      await d.octokit.request('POST /repos/{owner}/{repo}/git/refs', {
        owner: d.repo.externalOwner,
        repo: d.repo.externalName,
        ref: `refs/heads/${d.branchName}`,
        sha: initCommitSha
      });

      logGitHubSyncDebug('created base ref after contents api initialization', {
        repoId: d.repo.id,
        owner: d.repo.externalOwner,
        repo: d.repo.externalName,
        baseBranch: d.branchName,
        baseSha: initCommitSha
      });

      return initCommitSha;
    } catch (createRefError: any) {
      logGitHubSyncError(
        'failed to create base ref after contents api initialization',
        createRefError,
        {
          repoId: d.repo.id,
          owner: d.repo.externalOwner,
          repo: d.repo.externalName,
          baseBranch: d.branchName,
          initCommitSha
        }
      );
      if (createRefError.status === 422) {
        let existing = await d.octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
          owner: d.repo.externalOwner,
          repo: d.repo.externalName,
          ref: `heads/${d.branchName}`
        });

        logGitHubSyncDebug('base ref already exists after contents api initialization', {
          repoId: d.repo.id,
          owner: d.repo.externalOwner,
          repo: d.repo.externalName,
          baseBranch: d.branchName,
          baseSha: existing.data.object.sha
        });

        return existing.data.object.sha;
      }

      throw e;
    }
  }
};

let createNeutralGitHubMetorialCiCheck = async (d: {
  octokit: Awaited<ReturnType<typeof getGitHubClient>>;
  sync: SyncWithRepo;
  headSha: string;
}) => {
  try {
    logGitHubSyncDebug('creating neutral Metorial CI check run', {
      syncId: d.sync.id,
      repoId: d.sync.repo.id,
      owner: d.sync.repo.externalOwner,
      repo: d.sync.repo.externalName,
      branchName: d.sync.branchName,
      headSha: d.headSha
    });

    let checkRun = await d.octokit.request('POST /repos/{owner}/{repo}/check-runs', {
      owner: d.sync.repo.externalOwner,
      repo: d.sync.repo.externalName,
      name: 'Metorial Skill Sync',
      head_sha: d.headSha,
      status: 'completed',
      conclusion: 'neutral',
      external_id: d.sync.id,
      output: {
        title: 'Metorial Skill Sync',
        summary: 'Metorial completed repository synchronization for this pull request.'
      }
    });

    logGitHubSyncDebug('created neutral Metorial CI check run', {
      syncId: d.sync.id,
      repoId: d.sync.repo.id,
      owner: d.sync.repo.externalOwner,
      repo: d.sync.repo.externalName,
      checkRunId: checkRun.data.id,
      headSha: d.headSha
    });
  } catch (e: any) {
    logGitHubSyncError('failed to create neutral Metorial CI check run', e, {
      syncId: d.sync.id,
      repoId: d.sync.repo.id,
      owner: d.sync.repo.externalOwner,
      repo: d.sync.repo.externalName,
      branchName: d.sync.branchName,
      headSha: d.headSha
    });

    if (e.status === 403 && e.message?.includes('Resource not accessible by integration')) {
      throw new ServiceError(
        badRequestError({
          message:
            'GitHub App cannot create Metorial CI checks for this repository. Ensure the app installation has Checks: Read & write permission, then reinstall or update the installation.'
        })
      );
    }

    throw e;
  }
};

export let createRepositorySyncBranch = async (
  sync: SyncWithRepo,
  options?: {
    onLog?: (message: string) => Promise<void>;
  }
): Promise<{ baseBranch: string } | void> => {
  if (sync.repo.provider === 'github') {
    let octokit = await getGitHubClient(sync.repo);

    logGitHubSyncDebug('creating sync branch', {
      syncId: sync.id,
      repoId: sync.repo.id,
      owner: sync.repo.externalOwner,
      repo: sync.repo.externalName,
      baseBranch: sync.baseBranch,
      branchName: sync.branchName
    });

    let baseSha: string;

    try {
      logGitHubSyncDebug('loading base ref', {
        syncId: sync.id,
        repoId: sync.repo.id,
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        baseBranch: sync.baseBranch
      });

      let baseRef = await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        ref: `heads/${sync.baseBranch}`
      });
      baseSha = baseRef.data.object.sha;

      logGitHubSyncDebug('loaded base ref', {
        syncId: sync.id,
        repoId: sync.repo.id,
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        baseBranch: sync.baseBranch,
        baseSha
      });
    } catch (e: any) {
      logGitHubSyncError('failed to load base ref', e, {
        syncId: sync.id,
        repoId: sync.repo.id,
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        baseBranch: sync.baseBranch
      });
      if (!isGitHubEmptyRepositoryError(e)) throw e;

      baseSha = await initializeEmptyGitHubRepository({
        octokit,
        repo: sync.repo,
        branchName: sync.baseBranch
      });
    }

    try {
      logGitHubSyncDebug('creating provider branch ref', {
        syncId: sync.id,
        repoId: sync.repo.id,
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        branchName: sync.branchName,
        baseSha
      });

      await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        ref: `refs/heads/${sync.branchName}`,
        sha: baseSha
      });

      logGitHubSyncDebug('created provider branch ref', {
        syncId: sync.id,
        repoId: sync.repo.id,
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        branchName: sync.branchName,
        baseSha
      });
    } catch (e: any) {
      logGitHubSyncError('failed to create provider branch ref', e, {
        syncId: sync.id,
        repoId: sync.repo.id,
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        branchName: sync.branchName,
        baseSha
      });
      if (e.status !== 422) throw e;

      await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        ref: `heads/${sync.branchName}`
      });

      logGitHubSyncDebug('provider branch ref already exists', {
        syncId: sync.id,
        repoId: sync.repo.id,
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        branchName: sync.branchName
      });
    }

    return;
  }

  if (sync.repo.provider === 'gitlab') {
    let gitlab = await getGitLabClient(sync.repo);
    let projectId = parseInt(sync.repo.externalId);
    let context = {
      syncId: sync.id,
      repoId: sync.repo.id,
      projectId,
      cachedBaseBranch: sync.baseBranch,
      targetBranch: sync.branchName
    };

    await options?.onLog?.('Refreshing GitLab repository metadata.');
    let project;
    try {
      project = await runRetryableGitLabRead(() => gitlab.Projects.show(projectId));
    } catch (error) {
      throw wrapScmProviderError('gitlab', error, 'refresh repository metadata', {
        context,
        remediation:
          'Verify that the connected GitLab user can access this project and reconnect the integration if access changed.'
      });
    }

    let liveBaseBranch = getGitLabProjectDefaultBranch(project);
    let baseBranchName = liveBaseBranch ?? normalizeGitLabBranch(sync.baseBranch) ?? 'main';
    let baseBranch;

    if (!liveBaseBranch) {
      baseBranch = await initializeEmptyGitLabRepository({
        gitlab,
        projectId,
        branchName: baseBranchName,
        context,
        onLog: options?.onLog
      });
    } else {
      await options?.onLog?.(`Verifying GitLab base branch "${baseBranchName}".`);
      try {
        baseBranch = await getGitLabBranchOrNull(gitlab, projectId, baseBranchName);
      } catch (error) {
        throw wrapScmProviderError('gitlab', error, 'verify the base branch', {
          context: {
            ...context,
            liveBaseBranch: baseBranchName
          },
          remediation:
            'Verify that the connected GitLab user can read repository branches and that the project is still accessible.'
        });
      }

      if (!baseBranch) {
        throw new ServiceError(
          badRequestError({
            message:
              `GitLab reports "${baseBranchName}" as the default branch, but that branch does ` +
              `not exist or is not visible to the connected user. Repository: ${sync.repo.id}; ` +
              `project: ${projectId}; target branch: "${sync.branchName}". Refresh the GitLab ` +
              'project default branch or reconnect an account with repository access.'
          })
        );
      }
    }

    if (baseBranchName !== sync.baseBranch) {
      await options?.onLog?.(
        `Using live GitLab default branch "${baseBranchName}" instead of cached branch "${sync.baseBranch}".`
      );
    }

    let existingTarget;
    try {
      existingTarget = await getGitLabBranchOrNull(gitlab, projectId, sync.branchName);
    } catch (error) {
      throw wrapScmProviderError('gitlab', error, 'check the update branch', {
        context: {
          ...context,
          liveBaseBranch: baseBranchName
        }
      });
    }

    if (existingTarget) {
      assertGitLabSyncBranchIsSafe({
        branch: existingTarget,
        baseBranch,
        branchName: sync.branchName,
        baseBranchName
      });
      await options?.onLog?.(`Reusing existing GitLab update branch "${sync.branchName}".`);
      return { baseBranch: baseBranchName };
    }

    await options?.onLog?.(
      `Creating GitLab update branch "${sync.branchName}" from "${baseBranchName}".`
    );
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await gitlab.Branches.create(projectId, sync.branchName, baseBranchName);
      } catch (error) {
        let createdBranch;
        try {
          createdBranch = await waitForGitLabBranch(gitlab, projectId, sync.branchName);
        } catch (verifyError) {
          logGitLabSyncError('failed to verify branch after create error', verifyError, {
            ...context,
            liveBaseBranch: baseBranchName,
            createError: getScmProviderErrorDetails(error)
          });
        }

        if (createdBranch) {
          assertGitLabSyncBranchIsSafe({
            branch: createdBranch,
            baseBranch,
            branchName: sync.branchName,
            baseBranchName
          });
          await options?.onLog?.(
            `Verified GitLab update branch "${sync.branchName}" after an ambiguous create response.`
          );
          return { baseBranch: baseBranchName };
        }

        if (isRetryableScmProviderError(error) && attempt < 3) {
          await options?.onLog?.(
            `GitLab branch creation had a transient failure; retrying attempt ${attempt + 1} of 3.`
          );
          await gitLabDelay(attempt);
          continue;
        }

        throw wrapScmProviderError('gitlab', error, 'create the update branch', {
          context: {
            ...context,
            liveBaseBranch: baseBranchName,
            attempt
          },
          remediation:
            'Check the connected user’s Developer-or-higher access, protected branch rules matching the target name, and whether the target branch name is allowed.'
        });
      }

      let createdBranch = await waitForGitLabBranch(gitlab, projectId, sync.branchName);
      if (!createdBranch) {
        if (attempt < 3) {
          await options?.onLog?.(
            `GitLab did not expose the created branch yet; retrying verification attempt ${attempt + 1} of 3.`
          );
          await gitLabDelay(attempt);
          continue;
        }

        throw new ServiceError(
          badRequestError({
            message:
              `GitLab accepted update branch "${sync.branchName}" but the branch could not be ` +
              `verified after 3 attempts. Repository: ${sync.repo.id}; project: ${projectId}; ` +
              `base branch: "${baseBranchName}". Retry after GitLab finishes processing the branch.`
          })
        );
      }

      assertGitLabSyncBranchIsSafe({
        branch: createdBranch,
        baseBranch,
        branchName: sync.branchName,
        baseBranchName
      });
      await options?.onLog?.(`GitLab update branch "${sync.branchName}" is ready.`);
      return { baseBranch: baseBranchName };
    }

    throw new Error('GitLab branch creation retry loop exhausted');
  }

  if (sync.repo.provider === 'bitbucket') {
    let client = await getBitbucketClient(sync.repo);
    try {
      await client.getBranch(sync.repo.externalId, sync.baseBranch);
    } catch (error) {
      if (getScmProviderErrorStatus(error) !== 404) throw error;
      await client.initializeRepository(sync.repo.externalId, sync.baseBranch);
    }
    try {
      await client.createBranch(sync.repo.externalId, sync.branchName, sync.baseBranch);
    } catch (error) {
      if (![400, 409].includes(getScmProviderErrorStatus(error) ?? 0)) throw error;
      await client.getBranch(sync.repo.externalId, sync.branchName);
    }
    return;
  }

  throw new ServiceError(badRequestError({ message: 'Unsupported repository provider' }));
};

export let cleanupRepositorySyncBranchIfNoChanges = async (
  sync: SyncWithRepo
): Promise<{ hasChanges: boolean; baseSha?: string; branchSha?: string }> => {
  if (sync.repo.provider === 'github') {
    let octokit = await getGitHubClient(sync.repo);

    logGitHubSyncDebug('checking sync branch for changes', {
      syncId: sync.id,
      repoId: sync.repo.id,
      owner: sync.repo.externalOwner,
      repo: sync.repo.externalName,
      baseBranch: sync.baseBranch,
      branchName: sync.branchName
    });

    let [baseRef, branchRef] = await Promise.all([
      octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        ref: `heads/${sync.baseBranch}`
      }),
      octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        ref: `heads/${sync.branchName}`
      })
    ]);

    let baseSha = baseRef.data.object.sha;
    let branchSha = branchRef.data.object.sha;
    let hasChanges = baseSha !== branchSha;

    logGitHubSyncDebug('checked sync branch for changes', {
      syncId: sync.id,
      repoId: sync.repo.id,
      owner: sync.repo.externalOwner,
      repo: sync.repo.externalName,
      baseBranch: sync.baseBranch,
      branchName: sync.branchName,
      baseSha,
      branchSha,
      hasChanges
    });

    if (!hasChanges && sync.branchName !== sync.baseBranch) {
      await octokit.request('DELETE /repos/{owner}/{repo}/git/refs/{ref}', {
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        ref: `heads/${sync.branchName}`
      });

      logGitHubSyncDebug('deleted unchanged sync branch', {
        syncId: sync.id,
        repoId: sync.repo.id,
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        branchName: sync.branchName
      });
    } else if (!hasChanges) {
      logGitHubSyncDebug(
        'skipped deleting unchanged sync branch because it matches base branch',
        {
          syncId: sync.id,
          repoId: sync.repo.id,
          owner: sync.repo.externalOwner,
          repo: sync.repo.externalName,
          baseBranch: sync.baseBranch,
          branchName: sync.branchName
        }
      );
    }

    return { hasChanges, baseSha, branchSha };
  }

  if (sync.repo.provider === 'gitlab') {
    let gitlab = await getGitLabClient(sync.repo);

    logGitLabSyncDebug('checking sync branch for changes', {
      syncId: sync.id,
      repoId: sync.repo.id,
      projectId: sync.repo.externalId,
      baseBranch: sync.baseBranch,
      branchName: sync.branchName
    });

    let [baseBranch, syncBranch] = await Promise.all([
      gitlab.Branches.show(parseInt(sync.repo.externalId), sync.baseBranch),
      gitlab.Branches.show(parseInt(sync.repo.externalId), sync.branchName)
    ]);

    let baseSha = baseBranch.commit?.id;
    let branchSha = syncBranch.commit?.id;
    let hasChanges = baseSha !== branchSha;

    logGitLabSyncDebug('checked sync branch for changes', {
      syncId: sync.id,
      repoId: sync.repo.id,
      projectId: sync.repo.externalId,
      baseBranch: sync.baseBranch,
      branchName: sync.branchName,
      baseSha,
      branchSha,
      hasChanges
    });

    if (!hasChanges && sync.branchName !== sync.baseBranch) {
      await gitlab.Branches.remove(parseInt(sync.repo.externalId), sync.branchName);

      logGitLabSyncDebug('deleted unchanged sync branch', {
        syncId: sync.id,
        repoId: sync.repo.id,
        projectId: sync.repo.externalId,
        branchName: sync.branchName
      });
    } else if (!hasChanges) {
      logGitLabSyncDebug(
        'skipped deleting unchanged sync branch because it matches base branch',
        {
          syncId: sync.id,
          repoId: sync.repo.id,
          projectId: sync.repo.externalId,
          baseBranch: sync.baseBranch,
          branchName: sync.branchName
        }
      );
    }

    return { hasChanges, baseSha, branchSha };
  }

  if (sync.repo.provider === 'bitbucket') {
    let client = await getBitbucketClient(sync.repo);
    let [baseSha, branchSha] = await Promise.all([
      client.getBranch(sync.repo.externalId, sync.baseBranch),
      client.getBranch(sync.repo.externalId, sync.branchName)
    ]);
    let hasChanges = baseSha !== branchSha;
    if (!hasChanges && sync.branchName !== sync.baseBranch) {
      try {
        await client.deleteBranch(sync.repo.externalId, sync.branchName);
      } catch (error) {
        if (getScmProviderErrorStatus(error) !== 404) throw error;
      }
    }
    return { hasChanges, baseSha, branchSha };
  }

  throw new ServiceError(badRequestError({ message: 'Unsupported repository provider' }));
};

export let createRepositorySyncPullRequest = async (
  sync: SyncWithRepo
): Promise<{ providerPrId: string; providerPrUrl: string }> => {
  if (sync.repo.provider === 'github') {
    let octokit = await getGitHubClient(sync.repo);

    try {
      logGitHubSyncDebug('creating pull request', {
        syncId: sync.id,
        repoId: sync.repo.id,
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        baseBranch: sync.baseBranch,
        branchName: sync.branchName,
        title: sync.title
      });

      let pr = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        title: sync.title,
        body: sync.description ?? undefined,
        head: sync.branchName,
        base: sync.baseBranch
      });

      logGitHubSyncDebug('created pull request', {
        syncId: sync.id,
        repoId: sync.repo.id,
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        providerPrId: pr.data.number,
        providerPrUrl: pr.data.html_url,
        headSha: pr.data.head.sha
      });

      await createNeutralGitHubMetorialCiCheck({
        octokit,
        sync,
        headSha: pr.data.head.sha
      });

      return {
        providerPrId: pr.data.number.toString(),
        providerPrUrl: pr.data.html_url
      };
    } catch (e: any) {
      logGitHubSyncError('failed to create pull request', e, {
        syncId: sync.id,
        repoId: sync.repo.id,
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        baseBranch: sync.baseBranch,
        branchName: sync.branchName
      });

      if (e.status === 403 && e.message?.includes('Resource not accessible by integration')) {
        throw new ServiceError(
          badRequestError({
            message:
              'GitHub App cannot create pull requests for this repository. Ensure the app installation has Pull requests: Read & write and Contents: Read & write permissions, then reinstall or update the installation.'
          })
        );
      }

      if (e.status !== 422) throw e;

      logGitHubSyncDebug('looking for existing pull request after create conflict', {
        syncId: sync.id,
        repoId: sync.repo.id,
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        baseBranch: sync.baseBranch,
        branchName: sync.branchName
      });
      let existing = await octokit.request('GET /repos/{owner}/{repo}/pulls', {
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        head: `${sync.repo.externalOwner}:${sync.branchName}`,
        base: sync.baseBranch,
        state: 'open'
      });

      let pr = existing.data[0];
      if (!pr) throw e;

      logGitHubSyncDebug('found existing pull request', {
        syncId: sync.id,
        repoId: sync.repo.id,
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        providerPrId: pr.number,
        providerPrUrl: pr.html_url,
        headSha: pr.head.sha
      });

      await createNeutralGitHubMetorialCiCheck({
        octokit,
        sync,
        headSha: pr.head.sha
      });

      return {
        providerPrId: pr.number.toString(),
        providerPrUrl: pr.html_url
      };
    }
  }

  if (sync.repo.provider === 'gitlab') {
    let gitlab = await getGitLabClient(sync.repo);

    try {
      logGitLabSyncDebug('creating merge request', {
        syncId: sync.id,
        repoId: sync.repo.id,
        projectId: sync.repo.externalId,
        baseBranch: sync.baseBranch,
        branchName: sync.branchName,
        title: sync.title
      });

      let mr = await gitlab.MergeRequests.create(
        parseInt(sync.repo.externalId),
        sync.branchName,
        sync.baseBranch,
        sync.title,
        { description: sync.description ?? undefined }
      );

      logGitLabSyncDebug('created merge request', {
        syncId: sync.id,
        repoId: sync.repo.id,
        providerPrId: mr.iid,
        providerPrUrl: mr.web_url
      });

      return {
        providerPrId: mr.iid.toString(),
        providerPrUrl: mr.web_url
      };
    } catch (e: any) {
      logGitLabSyncError('failed to create merge request', e, {
        syncId: sync.id,
        repoId: sync.repo.id,
        projectId: sync.repo.externalId,
        baseBranch: sync.baseBranch,
        branchName: sync.branchName
      });
      if (e.response?.status !== 409 && e.response?.status !== 400) throw e;

      let mergeRequests = await gitlab.MergeRequests.all({
        projectId: parseInt(sync.repo.externalId),
        sourceBranch: sync.branchName,
        targetBranch: sync.baseBranch,
        state: 'opened'
      });

      let mr = mergeRequests[0];
      if (!mr) throw e;

      logGitLabSyncDebug('found existing merge request', {
        syncId: sync.id,
        repoId: sync.repo.id,
        providerPrId: mr.iid,
        providerPrUrl: mr.web_url
      });

      return {
        providerPrId: mr.iid.toString(),
        providerPrUrl: mr.web_url
      };
    }
  }

  if (sync.repo.provider === 'bitbucket') {
    let client = await getBitbucketClient(sync.repo);
    try {
      let pr = await client.createPullRequest({
        repositoryId: sync.repo.externalId,
        source: sync.branchName,
        destination: sync.baseBranch,
        title: sync.title,
        description: sync.description ?? undefined
      });
      return { providerPrId: pr.id, providerPrUrl: pr.url };
    } catch (error) {
      if (![400, 409].includes(getScmProviderErrorStatus(error) ?? 0)) throw error;
      let existing = await client.findOpenPullRequest(
        sync.repo.externalId,
        sync.branchName,
        sync.baseBranch
      );
      if (!existing) throw error;
      return { providerPrId: existing.id, providerPrUrl: existing.url };
    }
  }

  throw new ServiceError(badRequestError({ message: 'Unsupported repository provider' }));
};

export let closeRepositorySyncPullRequest = async (sync: SyncWithRepo) => {
  if (!sync.providerPrId) return 'missing' as const;

  if (sync.repo.provider === 'github') {
    let octokit = await getGitHubClient(sync.repo);
    try {
      let pr = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        pull_number: parseInt(sync.providerPrId)
      });
      if (pr.data.merged) return 'merged' as const;
      if (pr.data.state !== 'open') return 'already_closed' as const;
      await octokit.request('PATCH /repos/{owner}/{repo}/pulls/{pull_number}', {
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        pull_number: parseInt(sync.providerPrId),
        state: 'closed'
      });
      return 'closed' as const;
    } catch (error) {
      if (getScmProviderErrorStatus(error) !== 404) throw error;
      return 'missing' as const;
    }
  }

  if (sync.repo.provider === 'gitlab') {
    let gitlab = await getGitLabClient(sync.repo);
    let projectId = parseInt(sync.repo.externalId);
    try {
      let mergeRequest = await gitlab.MergeRequests.show(
        projectId,
        parseInt(sync.providerPrId)
      );
      if (mergeRequest.state === 'merged') return 'merged' as const;
      if (mergeRequest.state !== 'opened') return 'already_closed' as const;
      await gitlab.MergeRequests.edit(projectId, parseInt(sync.providerPrId), {
        stateEvent: 'close'
      });
      return 'closed' as const;
    } catch (error) {
      if (getScmProviderErrorStatus(error) !== 404) throw error;
      return 'missing' as const;
    }
  }

  if (sync.repo.provider === 'bitbucket') {
    let client = await getBitbucketClient(sync.repo);
    try {
      let pullRequest = await client.getPullRequestStatus(
        sync.repo.externalId,
        sync.providerPrId
      );
      let state = pullRequest.state.toUpperCase();
      if (['MERGED', 'FULFILLED'].includes(state)) return 'merged' as const;
      if (state !== 'OPEN') return 'already_closed' as const;
      await client.declinePullRequest(sync.repo.externalId, sync.providerPrId);
      return 'closed' as const;
    } catch (error) {
      if (getScmProviderErrorStatus(error) !== 404) throw error;
      return 'missing' as const;
    }
  }

  throw new ServiceError(badRequestError({ message: 'Unsupported repository provider' }));
};

export let getRepositorySyncStatusSnapshot = async (
  sync: SyncWithRepo,
  options?: { allowMissingPullRequestMetadata?: boolean }
): Promise<RepositorySyncStatusSnapshot> => {
  if (!sync.providerPrId || !sync.providerPrUrl) {
    if (options?.allowMissingPullRequestMetadata) {
      sync = {
        ...sync,
        providerPrId: sync.providerPrId ?? '0',
        providerPrUrl: sync.providerPrUrl ?? ''
      };
    } else {
      throw new ServiceError(
        badRequestError({ message: 'Pull request has not been created' })
      );
    }
  }

  let providerPrId = sync.providerPrId!;
  let providerPrUrl = sync.providerPrUrl!;
  let observedAt = new Date().toISOString();

  if (sync.repo.provider === 'github') {
    let octokit = await getGitHubClient(sync.repo);
    let [pr, statusItems, runItems, reviewItems] = await Promise.all([
      octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        pull_number: parseInt(providerPrId)
      }),
      collectGitHubPages<any>(async page => {
        let response = await octokit.request(
          'GET /repos/{owner}/{repo}/commits/{ref}/status',
          {
            owner: sync.repo.externalOwner,
            repo: sync.repo.externalName,
            ref: sync.branchName,
            per_page: 100,
            page
          }
        );
        return response.data.statuses ?? [];
      }),
      collectGitHubPages<any>(async page => {
        let response = await octokit.request(
          'GET /repos/{owner}/{repo}/commits/{ref}/check-runs',
          {
            owner: sync.repo.externalOwner,
            repo: sync.repo.externalName,
            ref: sync.branchName,
            per_page: 100,
            page
          } as any
        );
        return response.data.check_runs ?? [];
      }),
      collectGitHubPages<any>(async page => {
        let response = await octokit.request(
          'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
          {
            owner: sync.repo.externalOwner,
            repo: sync.repo.externalName,
            pull_number: parseInt(providerPrId),
            per_page: 100,
            page
          }
        );
        return response.data as any[];
      })
    ]);
    let checkItems: RepositorySyncStatusSnapshot['checks']['items'] = [
      ...statusItems.map((item: any) => ({
        name: item.context ?? 'Commit status',
        status: ['failure', 'error'].includes(item.state)
          ? ('failed' as const)
          : item.state === 'success'
            ? ('success' as const)
            : item.state === 'pending'
              ? ('pending' as const)
              : ('unknown' as const),
        url: item.target_url ?? null,
        summary: item.description ?? null
      })),
      ...runItems.map((item: any) => ({
        name: item.name ?? 'Check run',
        status: [
          'failure',
          'timed_out',
          'cancelled',
          'action_required',
          'startup_failure'
        ].includes(item.conclusion)
          ? ('failed' as const)
          : item.status === 'completed'
            ? ('success' as const)
            : ('pending' as const),
        url: item.details_url ?? item.html_url ?? null,
        summary: item.output?.summary ?? null
      }))
    ];
    let checkStates = checkItems.map(item => item.status);
    let failed = checkStates.filter(state => state === 'failed').length;
    let pending = checkStates.filter(state => state === 'pending').length;
    let successful = checkStates.filter(state => state === 'success').length;
    let latestReviews = new Map<string, string>();
    for (let review of reviewItems) {
      let reviewer = review.user?.id?.toString();
      if (reviewer) latestReviews.set(reviewer, String(review.state).toUpperCase());
    }
    let approvals = [...latestReviews.values()].filter(state => state === 'APPROVED').length;
    let changesRequested = [...latestReviews.values()].filter(
      state => state === 'CHANGES_REQUESTED'
    ).length;
    let requiredApprovals: number | undefined;
    try {
      let protection = await octokit.request(
        'GET /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews',
        {
          owner: sync.repo.externalOwner,
          repo: sync.repo.externalName,
          branch: sync.baseBranch
        }
      );
      requiredApprovals = protection.data.required_approving_review_count;
    } catch (error) {
      if (![403, 404].includes(getScmProviderErrorStatus(error) ?? 0)) throw error;
    }
    let mergeableState = (pr.data as any).mergeable_state;
    let mergeability: RepositorySyncStatusSnapshot['mergeability'] =
      pr.data.mergeable == null
        ? { state: 'checking', reason: mergeableState }
        : pr.data.mergeable === false
          ? { state: 'conflicting', reason: mergeableState }
          : ['blocked', 'draft'].includes(mergeableState)
            ? { state: 'blocked', reason: mergeableState }
            : { state: 'mergeable', reason: mergeableState };

    return {
      version: 1,
      provider: 'github',
      pullRequest: {
        id: providerPrId,
        url: providerPrUrl,
        state: pr.data.merged ? 'merged' : pr.data.state === 'open' ? 'open' : 'closed',
        mergeSha: pr.data.merge_commit_sha ?? null
      },
      checks: {
        state: failed ? 'failed' : pending ? 'pending' : 'success',
        total: checkStates.length,
        successful,
        pending,
        failed,
        items: checkItems
      },
      review: {
        state: changesRequested
          ? 'changes_requested'
          : requiredApprovals != null && approvals < requiredApprovals
            ? 'pending'
            : approvals
              ? 'approved'
              : mergeability.state === 'blocked' && mergeableState === 'blocked'
                ? 'pending'
                : 'not_required',
        approvals,
        changesRequested,
        requiredApprovals
      },
      mergeability,
      observedAt
    };
  }

  if (sync.repo.provider === 'gitlab') {
    let gitlab = await getGitLabClient(sync.repo);
    let projectId = parseInt(sync.repo.externalId);
    let [mergeRequest, pipelines] = await Promise.all([
      getGitLabMergeRequest(gitlab, projectId, parseInt(providerPrId)),
      gitlab.Pipelines.all(projectId, { ref: sync.branchName, perPage: 1 })
    ]);
    let pipeline = pipelines[0];
    let pipelineState = typeof pipeline?.status === 'string' ? pipeline.status : undefined;
    let failed = ['failed', 'canceled'].includes(pipelineState ?? '') ? 1 : 0;
    let pending =
      pipeline &&
      !['success', 'skipped', 'failed', 'canceled'].includes(pipelineState ?? '')
        ? 1
        : 0;
    let successful = pipeline && !failed && !pending ? 1 : 0;
    let checkItems: RepositorySyncStatusSnapshot['checks']['items'] = pipeline
      ? [
          {
            name:
              typeof pipeline.name === 'string' ? pipeline.name : `Pipeline ${pipeline.id}`,
            status: failed ? 'failed' : pending ? 'pending' : 'success',
            url: pipeline.web_url ?? null,
            summary: pipelineState ? `Pipeline is ${pipelineState}.` : null
          }
        ]
      : [];
    let detailed =
      mergeRequest.detailed_merge_status ?? mergeRequest.detailedMergeStatus ?? 'unknown';
    let approvals = 0;
    let approvalsRequired = 0;
    let approvalRulesPending = false;
    try {
      let approval = await gitlab.MergeRequestApprovals.showConfiguration(projectId, {
        mergerequestIId: parseInt(providerPrId)
      });
      approvals = approval?.approved_by?.length ?? 0;
      approvalsRequired = approval?.approvals_required ?? 0;
    } catch (error) {
      if (![403, 404].includes(getScmProviderErrorStatus(error) ?? 0)) throw error;
      // Approval APIs are unavailable on some GitLab editions.
    }
    try {
      let approvalState = await gitlab.MergeRequestApprovals.showApprovalState(
        projectId,
        parseInt(providerPrId)
      );
      let rules = (Array.isArray(approvalState?.rules) ? approvalState.rules : []) as {
        approvals_required?: number;
        approved?: boolean;
        approved_by?: unknown[];
      }[];
      approvalRulesPending = rules.some(
        rule => (rule.approvals_required ?? 0) > 0 && rule.approved !== true
      );
      approvalsRequired = Math.max(
        approvalsRequired,
        ...rules.map(rule => rule.approvals_required ?? 0)
      );
      approvals = Math.max(
        approvals,
        ...rules.map(rule => (Array.isArray(rule.approved_by) ? rule.approved_by.length : 0))
      );
    } catch (error) {
      if (![403, 404].includes(getScmProviderErrorStatus(error) ?? 0)) throw error;
      // Approval-state APIs are unavailable on some GitLab editions.
    }
    let reviewState: RepositorySyncStatusSnapshot['review']['state'] =
      approvalRulesPending || approvalsRequired > approvals || detailed === 'not_approved'
        ? 'pending'
        : approvals
          ? 'approved'
          : 'not_required';
    let mergeability: RepositorySyncStatusSnapshot['mergeability'] = [
      'unchecked',
      'checking',
      'preparing',
      'approvals_syncing',
      'unknown'
    ].includes(detailed)
      ? { state: 'checking', reason: detailed }
      : ['conflict', 'cannot_be_merged', 'need_rebase'].includes(detailed)
        ? { state: 'conflicting', reason: detailed }
        : detailed === 'mergeable'
          ? { state: 'mergeable', reason: detailed }
          : { state: 'blocked', reason: detailed };

    return {
      version: 1,
      provider: 'gitlab',
      pullRequest: {
        id: providerPrId,
        url: providerPrUrl,
        state:
          mergeRequest.state === 'merged'
            ? 'merged'
            : mergeRequest.state === 'opened'
              ? 'open'
              : 'closed',
        mergeSha:
          mergeRequest.merge_commit_sha ?? mergeRequest.squash_commit_sha ?? null
      },
      checks: {
        state: failed ? 'failed' : pending ? 'pending' : 'success',
        total: pipeline ? 1 : 0,
        successful,
        pending,
        failed,
        items: checkItems
      },
      review: {
        state: reviewState,
        approvals,
        changesRequested: 0,
        requiredApprovals: approvalsRequired
      },
      mergeability,
      observedAt
    };
  }

  if (sync.repo.provider === 'bitbucket') {
    let client = await getBitbucketClient(sync.repo);
    let [branchSha, pr] = await Promise.all([
      client.getBranch(sync.repo.externalId, sync.branchName),
      client.getPullRequestStatus(sync.repo.externalId, providerPrId)
    ]);
    let checkItems = await client.getCiChecks(sync.repo.externalId, branchSha);
    let failed = checkItems.filter(check => check.status === 'failed').length;
    let pending = checkItems.filter(check =>
      ['pending', 'unknown'].includes(check.status)
    ).length;
    let successful = checkItems.filter(check => check.status === 'success').length;
    let ciState: RepositorySyncStatusSnapshot['checks']['state'] = failed
      ? 'failed'
      : pending
        ? 'pending'
        : 'success';
    let state = pr.state.toUpperCase();
    return {
      version: 1,
      provider: 'bitbucket',
      pullRequest: {
        id: providerPrId,
        url: providerPrUrl,
        state: ['MERGED', 'FULFILLED'].includes(state)
          ? 'merged'
          : state === 'OPEN'
            ? 'open'
            : 'closed',
        mergeSha: pr.mergeSha ?? null
      },
      checks: {
        state: ciState,
        total: checkItems.length,
        successful,
        pending,
        failed,
        items: checkItems
      },
      review: {
        state: pr.changesRequested
          ? 'changes_requested'
          : pr.approvals
            ? 'approved'
            : 'unknown',
        approvals: pr.approvals,
        changesRequested: pr.changesRequested
      },
      mergeability: { state: pr.mergeability },
      observedAt
    };
  }

  throw new ServiceError(badRequestError({ message: 'Unsupported repository provider' }));
};

export let getRepositorySyncCiState = async (
  sync: SyncWithRepo
): Promise<RepositorySyncCiState> => {
  let snapshot = await getRepositorySyncStatusSnapshot(sync, {
    allowMissingPullRequestMetadata: true
  });
  if (snapshot.checks.state === 'failed' || snapshot.mergeability.state === 'conflicting')
    return 'failed';
  if (
    snapshot.checks.state === 'pending' ||
    snapshot.checks.state === 'unknown' ||
    ['checking', 'blocked', 'unknown'].includes(snapshot.mergeability.state)
  )
    return 'pending';
  return 'success';
  /*
  if (sync.repo.provider === 'github') {
    let octokit = await getGitHubClient(sync.repo);

    logGitHubSyncDebug('loading CI state', {
      syncId: sync.id,
      repoId: sync.repo.id,
      owner: sync.repo.externalOwner,
      repo: sync.repo.externalName,
      branchName: sync.branchName
    });

    let status;
    let checkRuns;
    try {
      [status, checkRuns] = await Promise.all([
        octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/status', {
          owner: sync.repo.externalOwner,
          repo: sync.repo.externalName,
          ref: sync.branchName
        }),
        octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/check-runs', {
          owner: sync.repo.externalOwner,
          repo: sync.repo.externalName,
          ref: sync.branchName
        } as any)
      ]);
    } catch (e: any) {
      logGitHubSyncError('failed to load CI state', e, {
        syncId: sync.id,
        repoId: sync.repo.id,
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        branchName: sync.branchName
      });
      throw e;
    }

    let statusState = status.data.total_count === 0 ? 'success' : status.data.state;
    let checkRunList = checkRuns.data.check_runs ?? [];
    let checkState =
      checkRuns.data.total_count === 0
        ? 'success'
        : checkRunList.some((check: any) =>
              ['failure', 'timed_out', 'cancelled', 'action_required'].includes(
                check.conclusion
              )
            )
          ? 'failed'
          : checkRunList.some(
                (check: any) => check.status !== 'completed' || !check.conclusion
              )
            ? 'pending'
            : 'success';

    logGitHubSyncDebug('loaded CI state', {
      syncId: sync.id,
      repoId: sync.repo.id,
      owner: sync.repo.externalOwner,
      repo: sync.repo.externalName,
      branchName: sync.branchName,
      statusTotalCount: status.data.total_count,
      statusState,
      checkRunTotalCount: checkRuns.data.total_count,
      checkState
    });

    if (statusState === 'failure' || statusState === 'error' || checkState === 'failed') {
      return 'failed';
    }

    if (statusState === 'pending' || checkState === 'pending') {
      return 'pending';
    }

    return 'success';
  }

  if (sync.repo.provider === 'gitlab') {
    let gitlab = await getGitLabClient(sync.repo);
    logGitLabSyncDebug('loading CI state', {
      syncId: sync.id,
      repoId: sync.repo.id,
      projectId: sync.repo.externalId,
      branchName: sync.branchName
    });

    let pipelines;
    let mergeRequest;
    try {
      [pipelines, mergeRequest] = await Promise.all([
        gitlab.Pipelines.all(parseInt(sync.repo.externalId), {
          ref: sync.branchName,
          perPage: 1
        }),
        getGitLabMergeRequest(
          gitlab,
          parseInt(sync.repo.externalId),
          parseInt(sync.providerPrId!)
        )
      ]);
    } catch (e: any) {
      logGitLabSyncError('failed to load CI state', e, {
        syncId: sync.id,
        repoId: sync.repo.id,
        projectId: sync.repo.externalId,
        branchName: sync.branchName
      });
      throw e;
    }

    let pipeline = pipelines[0];
    if (!pipeline) {
      logGitLabSyncDebug('no pipeline found; checking merge request status', {
        syncId: sync.id,
        repoId: sync.repo.id,
        branchName: sync.branchName
      });
    } else {
      logGitLabSyncDebug('loaded CI state', {
        syncId: sync.id,
        repoId: sync.repo.id,
        branchName: sync.branchName,
        pipelineId: pipeline.id,
        pipelineStatus: pipeline.status
      });

      if (['failed', 'canceled'].includes(pipeline.status)) return 'failed';
      if (!['success', 'skipped', 'manual'].includes(pipeline.status)) return 'pending';
    }

    if (mergeRequest.state === 'merged') return 'success';

    let mergeStatus = mergeRequest.detailed_merge_status ?? mergeRequest.detailedMergeStatus;
    if (mergeStatus === 'mergeable') return 'success';
    if (
      [
        'unchecked',
        'checking',
        'preparing',
        'approvals_syncing',
        'ci_still_running',
        'status_checks_must_pass'
      ].includes(mergeStatus)
    ) {
      return 'pending';
    }

    return 'failed';
  }

  if (sync.repo.provider === 'bitbucket') {
    if (!sync.providerPrId) {
      throw new ServiceError(
        badRequestError({ message: 'Pull request has not been created' })
      );
    }
    let client = await getBitbucketClient(sync.repo);
    let [branchSha, pr] = await Promise.all([
      client.getBranch(sync.repo.externalId, sync.branchName),
      client.getPullRequest(sync.repo.externalId, sync.providerPrId)
    ]);
    if (['MERGED', 'FULFILLED'].includes(pr.state.toUpperCase())) return 'success';
    if (['DECLINED', 'SUPERSEDED'].includes(pr.state.toUpperCase())) return 'failed';
    return client.getCiState(sync.repo.externalId, branchSha);
  }

  throw new ServiceError(badRequestError({ message: 'Unsupported repository provider' }));
  */
};

export let mergeRepositorySyncPullRequest = async (
  sync: SyncWithRepo
): Promise<{ mergeSha?: string }> => {
  if (!sync.providerPrId) {
    throw new ServiceError(badRequestError({ message: 'Pull request has not been created' }));
  }

  if (sync.repo.provider === 'github') {
    let octokit = await getGitHubClient(sync.repo);

    logGitHubSyncDebug('merging pull request', {
      syncId: sync.id,
      repoId: sync.repo.id,
      owner: sync.repo.externalOwner,
      repo: sync.repo.externalName,
      providerPrId: sync.providerPrId
    });

    let merge;
    try {
      merge = await octokit.request('PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge', {
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        pull_number: parseInt(sync.providerPrId)
      });
    } catch (e: any) {
      logGitHubSyncError('failed to merge pull request', e, {
        syncId: sync.id,
        repoId: sync.repo.id,
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        providerPrId: sync.providerPrId
      });
      throw e;
    }

    logGitHubSyncDebug('merged pull request', {
      syncId: sync.id,
      repoId: sync.repo.id,
      owner: sync.repo.externalOwner,
      repo: sync.repo.externalName,
      providerPrId: sync.providerPrId,
      mergeSha: merge.data.sha
    });

    if (sync.branchName !== sync.baseBranch) {
      try {
        await octokit.request('DELETE /repos/{owner}/{repo}/git/refs/{ref}', {
          owner: sync.repo.externalOwner,
          repo: sync.repo.externalName,
          ref: `heads/${sync.branchName}`
        });

        logGitHubSyncDebug('deleted merged sync branch', {
          syncId: sync.id,
          repoId: sync.repo.id,
          owner: sync.repo.externalOwner,
          repo: sync.repo.externalName,
          branchName: sync.branchName
        });
      } catch (e: any) {
        if (e.status !== 404) {
          logGitHubSyncError('failed to delete merged sync branch', e, {
            syncId: sync.id,
            repoId: sync.repo.id,
            owner: sync.repo.externalOwner,
            repo: sync.repo.externalName,
            branchName: sync.branchName
          });
          throw e;
        }

        logGitHubSyncDebug('merged sync branch was already deleted', {
          syncId: sync.id,
          repoId: sync.repo.id,
          owner: sync.repo.externalOwner,
          repo: sync.repo.externalName,
          branchName: sync.branchName
        });
      }
    } else {
      logGitHubSyncDebug(
        'skipped deleting merged sync branch because it matches base branch',
        {
          syncId: sync.id,
          repoId: sync.repo.id,
          owner: sync.repo.externalOwner,
          repo: sync.repo.externalName,
          baseBranch: sync.baseBranch,
          branchName: sync.branchName
        }
      );
    }

    return { mergeSha: merge.data.sha };
  }

  if (sync.repo.provider === 'gitlab') {
    let gitlab = await getGitLabClient(sync.repo);
    let mergeRequestBeforeMerge = await getGitLabMergeRequest(
      gitlab,
      parseInt(sync.repo.externalId),
      parseInt(sync.providerPrId)
    );
    if (mergeRequestBeforeMerge.state === 'merged') {
      return {
        mergeSha:
          mergeRequestBeforeMerge.merge_commit_sha ??
          mergeRequestBeforeMerge.squash_commit_sha ??
          undefined
      };
    }
    let sourceSha = mergeRequestBeforeMerge.sha ?? mergeRequestBeforeMerge.diff_refs?.head_sha;
    if (!sourceSha) {
      throw new Error('GitLab did not return the merge request source SHA');
    }
    logGitLabSyncDebug('merging merge request', {
      syncId: sync.id,
      repoId: sync.repo.id,
      projectId: sync.repo.externalId,
      providerPrId: sync.providerPrId,
      sourceSha
    });

    let merge;
    try {
      merge = await gitlab.MergeRequests.merge(
        parseInt(sync.repo.externalId),
        parseInt(sync.providerPrId),
        {
          sha: sourceSha,
          shouldRemoveSourceBranch: sync.branchName !== sync.baseBranch
        }
      );
    } catch (e: any) {
      let authenticatedUser:
        | { id: number | string | undefined; username: string | undefined }
        | undefined;
      let authenticatedUserError;
      try {
        let user = await gitlab.Users.showCurrentUser();
        authenticatedUser = {
          id: user.id,
          username: user.username
        };
      } catch (identityError) {
        authenticatedUserError = getScmProviderErrorDetails(identityError);
      }

      let mergeRequest: GitLabMergeRequestStatus | undefined;
      let mergeRequestError;
      try {
        mergeRequest = await getGitLabMergeRequest(
          gitlab,
          parseInt(sync.repo.externalId),
          parseInt(sync.providerPrId)
        );
      } catch (statusError) {
        mergeRequestError = getScmProviderErrorDetails(statusError);
      }

      logGitLabSyncError('failed to merge merge request', e, {
        syncId: sync.id,
        repoId: sync.repo.id,
        projectId: sync.repo.externalId,
        providerPrId: sync.providerPrId,
        authenticatedUser,
        authenticatedUserError,
        mergeRequest: mergeRequest
          ? {
              state: mergeRequest.state,
              detailedMergeStatus:
                mergeRequest.detailed_merge_status ?? mergeRequest.detailedMergeStatus,
              mergeStatus: mergeRequest.merge_status,
              mergeError: mergeRequest.merge_error,
              hasConflicts: mergeRequest.has_conflicts,
              blockingDiscussionsResolved: mergeRequest.blocking_discussions_resolved,
              draft: mergeRequest.draft
            }
          : undefined,
        mergeRequestError
      });

      if (mergeRequest?.state === 'merged') {
        return {
          mergeSha:
            mergeRequest.merge_commit_sha ?? mergeRequest.squash_commit_sha ?? undefined
        };
      }

      if (
        e &&
        typeof e === 'object' &&
        [401, 403].includes(getScmProviderErrorStatus(e) ?? 0)
      ) {
        Object.defineProperty(e, 'scmMergePermissionDenied', {
          value: true,
          enumerable: false
        });
      }

      throw e;
    }

    logGitLabSyncDebug('merged merge request', {
      syncId: sync.id,
      repoId: sync.repo.id,
      providerPrId: sync.providerPrId,
      mergeSha: merge.merge_commit_sha ?? merge.sha
    });

    return { mergeSha: merge.merge_commit_sha ?? merge.sha };
  }

  if (sync.repo.provider === 'bitbucket') {
    let client = await getBitbucketClient(sync.repo);
    let merge = await client.mergePullRequest(sync.repo.externalId, sync.providerPrId);
    if (sync.branchName !== sync.baseBranch) {
      try {
        await client.deleteBranch(sync.repo.externalId, sync.branchName);
      } catch (error) {
        if (getScmProviderErrorStatus(error) !== 404) throw error;
      }
    }
    return { mergeSha: merge.mergeSha };
  }

  throw new ServiceError(badRequestError({ message: 'Unsupported repository provider' }));
};
