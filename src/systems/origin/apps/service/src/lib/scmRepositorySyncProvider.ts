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

  return createGitHubInstallationClient(repo.installation.externalInstallationId, repo.installation.backend);
};

let getGitLabClient = (repo: SyncWithRepo['repo']) => {
  if (!repo.installation.accessToken) {
    throw new ServiceError(badRequestError({ message: 'Access token not found' }));
  }

  return createGitLabClientWithToken(repo.installation.accessToken, repo.installation.backend) as any;
};

export let createRepositorySyncBranch = async (sync: SyncWithRepo) => {
  if (sync.repo.provider === 'github') {
    let octokit = await getGitHubClient(sync.repo);

    let baseRef = await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
      owner: sync.repo.externalOwner,
      repo: sync.repo.externalName,
      ref: `heads/${sync.baseBranch}`
    });

    try {
      await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        ref: `refs/heads/${sync.branchName}`,
        sha: baseRef.data.object.sha
      });
    } catch (e: any) {
      if (e.status !== 422) throw e;

      await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        ref: `heads/${sync.branchName}`
      });
    }

    return;
  }

  if (sync.repo.provider === 'gitlab') {
    let gitlab = getGitLabClient(sync.repo);

    try {
      await gitlab.Branches.create(parseInt(sync.repo.externalId), sync.branchName, sync.baseBranch);
    } catch (e: any) {
      if (e.response?.status !== 400 && e.response?.status !== 409) throw e;

      await gitlab.Branches.show(parseInt(sync.repo.externalId), sync.branchName);
    }

    return;
  }

  throw new ServiceError(badRequestError({ message: 'Unsupported repository provider' }));
};

export let createRepositorySyncPullRequest = async (
  sync: SyncWithRepo
): Promise<{ providerPrId: string; providerPrUrl: string }> => {
  if (sync.repo.provider === 'github') {
    let octokit = await getGitHubClient(sync.repo);

    try {
      let pr = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        title: sync.title,
        body: sync.description ?? undefined,
        head: sync.branchName,
        base: sync.baseBranch
      });

      return {
        providerPrId: pr.data.number.toString(),
        providerPrUrl: pr.data.html_url
      };
    } catch (e: any) {
      if (e.status !== 422) throw e;

      let existing = await octokit.request('GET /repos/{owner}/{repo}/pulls', {
        owner: sync.repo.externalOwner,
        repo: sync.repo.externalName,
        head: `${sync.repo.externalOwner}:${sync.branchName}`,
        base: sync.baseBranch,
        state: 'open'
      });

      let pr = existing.data[0];
      if (!pr) throw e;

      return {
        providerPrId: pr.number.toString(),
        providerPrUrl: pr.html_url
      };
    }
  }

  if (sync.repo.provider === 'gitlab') {
    let gitlab = getGitLabClient(sync.repo);

    try {
      let mr = await gitlab.MergeRequests.create(
        parseInt(sync.repo.externalId),
        sync.branchName,
        sync.baseBranch,
        sync.title,
        { description: sync.description ?? undefined }
      );

      return {
        providerPrId: mr.iid.toString(),
        providerPrUrl: mr.web_url
      };
    } catch (e: any) {
      if (e.response?.status !== 409 && e.response?.status !== 400) throw e;

      let mergeRequests = await gitlab.MergeRequests.all({
        projectId: parseInt(sync.repo.externalId),
        sourceBranch: sync.branchName,
        targetBranch: sync.baseBranch,
        state: 'opened'
      });

      let mr = mergeRequests[0];
      if (!mr) throw e;

      return {
        providerPrId: mr.iid.toString(),
        providerPrUrl: mr.web_url
      };
    }
  }

  throw new ServiceError(badRequestError({ message: 'Unsupported repository provider' }));
};

export let getRepositorySyncCiState = async (sync: SyncWithRepo): Promise<RepositorySyncCiState> => {
  if (sync.repo.provider === 'github') {
    let octokit = await getGitHubClient(sync.repo);

    let [status, checkRuns] = await Promise.all([
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

    let statusState = status.data.total_count === 0 ? 'success' : status.data.state;
    let checkRunList = checkRuns.data.check_runs ?? [];
    let checkState =
      checkRuns.data.total_count === 0
        ? 'success'
        : checkRunList.some((check: any) =>
            ['failure', 'timed_out', 'cancelled', 'action_required'].includes(check.conclusion)
          )
          ? 'failed'
          : checkRunList.some((check: any) => check.status !== 'completed' || !check.conclusion)
            ? 'pending'
            : 'success';

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
    let pipelines = await gitlab.Pipelines.all(parseInt(sync.repo.externalId), {
      ref: sync.branchName,
      perPage: 1
    });

    let pipeline = pipelines[0];
    if (!pipeline) return 'success';

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

    let merge = await octokit.request('PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge', {
      owner: sync.repo.externalOwner,
      repo: sync.repo.externalName,
      pull_number: parseInt(sync.providerPrId)
    });

    return { mergeSha: merge.data.sha };
  }

  if (sync.repo.provider === 'gitlab') {
    let gitlab = getGitLabClient(sync.repo);
    let merge = await gitlab.MergeRequests.merge(
      parseInt(sync.repo.externalId),
      parseInt(sync.providerPrId),
      { shouldRemoveSourceBranch: false }
    );

    return { mergeSha: merge.merge_commit_sha ?? merge.sha };
  }

  throw new ServiceError(badRequestError({ message: 'Unsupported repository provider' }));
};
