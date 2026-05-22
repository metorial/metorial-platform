import type {
  CustomProvidersGetOutput,
  DashboardInstanceCustomProvidersGetOutput,
  DashboardInstanceCustomProvidersVersionsCreateBody
} from '@metorial/dashboard-sdk';

export type CustomProviderRemoteProtocol = 'sse' | 'streamable_http';

export let normalizeRepoPath = (path: string | null | undefined) => {
  let trimmed = path?.trim();
  return trimmed ? trimmed : undefined;
};

export let normalizeEnvRecord = (env: Record<string, any> | null | undefined) => {
  let normalized: Record<string, string> = {};

  for (let [key, value] of Object.entries(env ?? {})) {
    let normalizedKey = key.trim();
    if (!normalizedKey) continue;
    normalized[normalizedKey] = String(value ?? '');
  }

  return normalized;
};

export let getFunctionProviderVersionFrom = (
  customProvider: CustomProvidersGetOutput | DashboardInstanceCustomProvidersGetOutput,
  env: Record<string, string>
): DashboardInstanceCustomProvidersVersionsCreateBody['from'] => {
  let linkedRepo = getCustomProviderLinkedRepo(customProvider);
  let runtime = { identifier: 'nodejs' as const, version: '22.x' as const };

  if (linkedRepo?.id) {
    return {
      type: 'function',
      env,
      runtime,
      repository: {
        repositoryId: linkedRepo.id,
        branch: linkedRepo.defaultBranch || 'main',
        path: normalizeRepoPath(linkedRepo.path)
      }
    };
  }

  return {
    type: 'function',
    files: [],
    env,
    runtime
  };
};

export let normalizeTrackedBranch = (branch: string | null | undefined) => {
  let normalizedBranch = branch?.trim();
  return normalizedBranch ? normalizedBranch : undefined;
};

export let getCustomProviderLinkedRepo = (
  provider: DashboardInstanceCustomProvidersGetOutput | null | undefined
) => {
  let repository = provider?.scmRepo ?? provider?.draftBucket?.scmRepoLink?.repository;
  if (!repository) return null;

  return {
    id: repository.id,
    url: repository.url,
    defaultBranch: repository.defaultBranch,
    path: provider?.draftBucket?.scmRepoLink?.path ?? undefined
  };
};

export let getCustomProviderScmLink = (
  provider: DashboardInstanceCustomProvidersGetOutput | null | undefined
) => {
  let linkedRepo = getCustomProviderLinkedRepo(provider);
  let repositoryUrl = linkedRepo?.url?.trim();
  let branch = normalizeTrackedBranch(linkedRepo?.defaultBranch);

  if (!repositoryUrl) return null;

  return {
    repositoryUrl,
    branch
  };
};

export let isCustomProviderScmBacked = (
  provider: DashboardInstanceCustomProvidersGetOutput | null | undefined
) => Boolean(provider?.scmRepo || provider?.draftBucket?.scmRepoLink?.repository);

export let getCustomProviderRemoteProtocolFromUrl = (
  remoteUrl: string | null | undefined
): CustomProviderRemoteProtocol => {
  let normalizedRemoteUrl = remoteUrl?.trim();
  if (!normalizedRemoteUrl) return 'streamable_http';

  try {
    let url = new URL(normalizedRemoteUrl);
    let pathname = url.pathname.toLowerCase();
    let transport = url.searchParams.get('transport')?.toLowerCase();
    let protocol = url.searchParams.get('protocol')?.toLowerCase();

    if (
      pathname === '/sse' ||
      pathname.endsWith('/sse') ||
      pathname.includes('/sse/') ||
      transport === 'sse' ||
      protocol === 'sse'
    ) {
      return 'sse';
    }
  } catch {}

  return 'streamable_http';
};

export let waitForCustomProviderVersionId = async (
  getVersionId: () => Promise<string | undefined>,
  opts?: { attempts?: number; delayMs?: number }
) => {
  let attempts = opts?.attempts ?? 15;
  let delayMs = opts?.delayMs ?? 1000;

  for (let attempt = 0; attempt < attempts; attempt++) {
    let versionId = await getVersionId();
    if (versionId) return versionId;

    if (attempt < attempts - 1) {
      await new Promise(resolve => globalThis.setTimeout(resolve, delayMs));
    }
  }

  return undefined;
};
