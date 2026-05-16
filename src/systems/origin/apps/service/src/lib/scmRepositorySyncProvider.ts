import { badRequestError, ServiceError } from '@lowerdeck/error';
import type {
  ScmBackend,
  ScmInstallation,
  ScmRepository,
  ScmRepositorySync
} from '../../prisma/generated/client';
import { createGitHubInstallationClient } from './githubApp';
import { createGitLabClientWithToken } from './gitlab';

type SyncWithRepo = ScmRepositorySync & {
  repo: ScmRepository & {
    installation: ScmInstallation & {
      backend: ScmBackend;
    };
  };
};

export type RepositorySyncCiState = 'pending' | 'success' | 'failed';

let getGitHubClient = async (repo: SyncWithRepo['repo']) => {
  if (!repo.installation.externalInstallationId) {
    throw new ServiceError(badRequestError({ message: 'Installation ID not found' }));
  }

  return createGitHubInstallationClient(
    repo.installation.externalInstallationId,
    repo.installation.backend
  );
};

let getGitLabClient = (repo: SyncWithRepo['repo']) => {
  if (!repo.installation.accessToken) {
    throw new ServiceError(badRequestError({ message: 'Access token not found' }));
  }

  return createGitLabClientWithToken(
    repo.installation.accessToken,
    repo.installation.backend
  ) as any;
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
  void message;
  void d;
};

let logGitLabSyncError = (message: string, e: any, d: Record<string, unknown>) => {
  void message;
  void e;
  void d;
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

export let createRepositorySyncBranch = async (sync: SyncWithRepo) => {
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
    let gitlab = getGitLabClient(sync.repo);

    try {
      await gitlab.Branches.create(
        parseInt(sync.repo.externalId),
        sync.branchName,
        sync.baseBranch
      );
    } catch (e: any) {
      if (e.response?.status !== 400 && e.response?.status !== 409) throw e;

      await gitlab.Branches.show(parseInt(sync.repo.externalId), sync.branchName);
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
    let gitlab = getGitLabClient(sync.repo);

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
    let gitlab = getGitLabClient(sync.repo);

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

  throw new ServiceError(badRequestError({ message: 'Unsupported repository provider' }));
};

export let getRepositorySyncCiState = async (
  sync: SyncWithRepo
): Promise<RepositorySyncCiState> => {
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
    let gitlab = getGitLabClient(sync.repo);
    logGitLabSyncDebug('loading CI state', {
      syncId: sync.id,
      repoId: sync.repo.id,
      projectId: sync.repo.externalId,
      branchName: sync.branchName
    });

    let pipelines;
    try {
      pipelines = await gitlab.Pipelines.all(parseInt(sync.repo.externalId), {
        ref: sync.branchName,
        perPage: 1
      });
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
      logGitLabSyncDebug('no pipeline found; treating CI as success', {
        syncId: sync.id,
        repoId: sync.repo.id,
        branchName: sync.branchName
      });
      return 'success';
    }

    logGitLabSyncDebug('loaded CI state', {
      syncId: sync.id,
      repoId: sync.repo.id,
      branchName: sync.branchName,
      pipelineId: pipeline.id,
      pipelineStatus: pipeline.status
    });

    if (['success', 'skipped', 'manual'].includes(pipeline.status)) return 'success';
    if (['failed', 'canceled'].includes(pipeline.status)) return 'failed';
    return 'pending';
  }

  throw new ServiceError(badRequestError({ message: 'Unsupported repository provider' }));
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
    let gitlab = getGitLabClient(sync.repo);
    logGitLabSyncDebug('merging merge request', {
      syncId: sync.id,
      repoId: sync.repo.id,
      projectId: sync.repo.externalId,
      providerPrId: sync.providerPrId
    });

    let merge;
    try {
      merge = await gitlab.MergeRequests.merge(
        parseInt(sync.repo.externalId),
        parseInt(sync.providerPrId),
        { shouldRemoveSourceBranch: sync.branchName !== sync.baseBranch }
      );
    } catch (e: any) {
      logGitLabSyncError('failed to merge merge request', e, {
        syncId: sync.id,
        repoId: sync.repo.id,
        projectId: sync.repo.externalId,
        providerPrId: sync.providerPrId
      });
      throw e;
    }

    logGitLabSyncDebug('merged merge request', {
      syncId: sync.id,
      repoId: sync.repo.id,
      providerPrId: sync.providerPrId,
      mergeSha: merge.merge_commit_sha ?? merge.sha
    });

    if (sync.branchName !== sync.baseBranch) {
      try {
        await gitlab.Branches.remove(parseInt(sync.repo.externalId), sync.branchName);

        logGitLabSyncDebug('deleted merged sync branch', {
          syncId: sync.id,
          repoId: sync.repo.id,
          projectId: sync.repo.externalId,
          branchName: sync.branchName
        });
      } catch (e: any) {
        let status = e?.response?.status ?? e?.cause?.response?.statusCode;
        if (status !== 404) {
          logGitLabSyncError('failed to delete merged sync branch', e, {
            syncId: sync.id,
            repoId: sync.repo.id,
            projectId: sync.repo.externalId,
            branchName: sync.branchName
          });
          throw e;
        }

        logGitLabSyncDebug('merged sync branch was already deleted', {
          syncId: sync.id,
          repoId: sync.repo.id,
          projectId: sync.repo.externalId,
          branchName: sync.branchName
        });
      }
    } else {
      logGitLabSyncDebug(
        'skipped deleting merged sync branch because it matches base branch',
        {
          syncId: sync.id,
          repoId: sync.repo.id,
          projectId: sync.repo.externalId,
          baseBranch: sync.baseBranch,
          branchName: sync.branchName
        }
      );
    }

    return { mergeSha: merge.merge_commit_sha ?? merge.sha };
  }

  throw new ServiceError(badRequestError({ message: 'Unsupported repository provider' }));
};
