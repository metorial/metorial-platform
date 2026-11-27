import type {
  DashboardInstanceScmAccountsPreviewOutput,
  DashboardInstanceScmInstallationListOutput,
  DashboardInstanceScmReposPreviewOutput
} from '@metorial/dashboard-sdk';

export type ScmProvider = 'github' | 'gitlab' | 'bitbucket';

export type ScmInstallation = DashboardInstanceScmInstallationListOutput['items'][number];

export type ScmRepositoryPreview = DashboardInstanceScmReposPreviewOutput['repos'][number];

export type ScmAccountSelection = {
  installationId: string;
  externalAccountId: string;
  provider: ScmProvider;
  name: string;
  identifier: string;
  accountType: string;
  installationName: string;
  imageUrl?: string | null;
  installationImageUrl?: string | null;
};

export type PublicScmRepositoryUrl = {
  provider: ScmProvider;
  identifier: string;
  url: string;
};

let publicScmProviders: Record<string, ScmProvider> = {
  'github.com': 'github',
  'gitlab.com': 'gitlab',
  'bitbucket.org': 'bitbucket'
};

export let parsePublicScmRepositoryUrl = (value: string): PublicScmRepositoryUrl | null => {
  try {
    let input = value.trim();
    let url = new URL(input.includes('://') ? input : `https://${input}`);
    let hostname = url.hostname.toLowerCase();
    let provider = publicScmProviders[hostname];
    if (
      !provider ||
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null;
    }

    let parts = url.pathname
      .replace(/^\/+|\/+$/g, '')
      .replace(/\.git$/i, '')
      .split('/')
      .filter(Boolean);
    if (parts.length < 2) return null;
    if (provider != 'gitlab' && parts.length != 2) return null;
    if (provider == 'gitlab' && parts.includes('-')) return null;

    let identifier = parts.join('/');
    return {
      provider,
      identifier,
      url: `https://${hostname}/${identifier}`
    };
  } catch {
    return null;
  }
};

export let formatScmProvider = (provider: string) =>
  ({
    github: 'GitHub',
    github_enterprise: 'GitHub Enterprise',
    gitlab: 'GitLab',
    gitlab_selfhosted: 'GitLab Self-Managed',
    bitbucket: 'Bitbucket',
    bitbucket_data_center: 'Bitbucket Data Center'
  })[provider] ?? provider;

export let formatAccountType = (accountType: string | null | undefined) =>
  accountType
    ? accountType
        .split('_')
        .map(part => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
        .join(' ')
    : 'Account';

export let getInstallationName = (installation: ScmInstallation) =>
  installation.externalAccount.name ??
  installation.externalAccount.email ??
  installation.externalAccount.login;

export let makeScmAccountSelection = (
  installation: ScmInstallation,
  account: DashboardInstanceScmAccountsPreviewOutput['accounts'][number]
): ScmAccountSelection => ({
  installationId: installation.id,
  externalAccountId: account.externalId,
  provider: account.provider,
  name: account.name,
  identifier: account.identifier,
  accountType: formatAccountType(installation.accountType),
  installationName: getInstallationName(installation),
  imageUrl: account.imageUrl,
  installationImageUrl: installation.externalAccount.imageUrl
});

export let filterScmRepositories = (
  repositories: ScmRepositoryPreview[],
  search: string,
  excludedExternalIds: string[] = [],
  excludedIdentifiers: string[] = []
) => {
  let normalizedSearch = search.trim().toLowerCase();
  let excluded = new Set(excludedExternalIds);
  let normalizedExcludedIdentifiers = new Set(
    excludedIdentifiers.map(identifier => identifier.replace(/^\/+|\/+$/g, '').toLowerCase())
  );

  return repositories.filter(repository => {
    if (excluded.has(repository.externalId)) return false;
    if (normalizedExcludedIdentifiers.has(repository.identifier.toLowerCase())) return false;
    if (!normalizedSearch) return true;

    return (
      repository.name.toLowerCase().includes(normalizedSearch) ||
      repository.identifier.toLowerCase().includes(normalizedSearch)
    );
  });
};
