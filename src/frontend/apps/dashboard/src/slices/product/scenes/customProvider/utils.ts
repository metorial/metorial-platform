export type CustomProviderRemoteProtocol = 'sse' | 'streamable_http';

let METORIAL_INTERNAL_EMAIL_DOMAINS = ['@metorial.com', '@metorial.work'];

type CustomProviderScmLike = {
  scmRepo?: { url?: string | null; defaultBranch?: string | null } | null;
  draftBucket?: {
    scmRepoLink?: {
      repository?: { url?: string | null; defaultBranch?: string | null } | null;
    } | null;
  } | null;
  metadata?: {
    repository?: {
      url?: string | null;
      branch?: string | null;
    } | null;
  } | null;
};

export let normalizeTrackedBranch = (branch: string | null | undefined) => {
  let normalizedBranch = branch?.trim();
  return normalizedBranch ? normalizedBranch : undefined;
};

export let getCustomProviderScmLink = (
  provider: CustomProviderScmLike | null | undefined
) => {
  let scmRepoLink = provider?.draftBucket?.scmRepoLink;
  let metadataRepo = provider?.metadata?.repository;
  let repositoryUrl =
    scmRepoLink?.repository?.url?.trim() ||
    provider?.scmRepo?.url?.trim() ||
    metadataRepo?.url?.trim();
  let branch = normalizeTrackedBranch(
    scmRepoLink?.repository?.defaultBranch ?? provider?.scmRepo?.defaultBranch ?? metadataRepo?.branch
  );

  if (!repositoryUrl) return null;

  return {
    repositoryUrl,
    branch
  };
};

export let isCustomProviderScmBacked = (
  provider: CustomProviderScmLike | null | undefined
) => Boolean(getCustomProviderScmLink(provider));

export let isMetorialInternalEmail = (email: string | null | undefined) => {
  let normalizedEmail = email?.trim().toLowerCase();
  return Boolean(
    normalizedEmail &&
      METORIAL_INTERNAL_EMAIL_DOMAINS.some(domain => normalizedEmail.endsWith(domain))
  );
};

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
