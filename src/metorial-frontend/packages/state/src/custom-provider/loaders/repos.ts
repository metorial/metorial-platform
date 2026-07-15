import {
  DashboardInstanceScmAccountsPreviewBody,
  DashboardInstanceScmInstallationCreateBody,
  DashboardInstanceScmInstallationListQuery,
  DashboardInstanceScmReposCreateBody,
  DashboardInstanceScmReposCreateOutput,
  DashboardInstanceScmReposPreviewBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let scmInstallationsLoader = createLoader({
  name: 'scmInstallations',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceScmInstallationListQuery) =>
    withAuth(sdk => sdk.scm.installation.list(i.instanceId, i)),
  mutators: {}
});

export let useScmInstallations = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceScmInstallationListQuery
) => {
  let data = usePaginator(pagination =>
    scmInstallationsLoader.use(
      instanceId ? { instanceId, ...pagination, ...query } : null
    )
  );

  return data;
};

export let useCreateScmInstallation = scmInstallationsLoader.createExternalMutator(
  (i: DashboardInstanceScmInstallationCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.scm.installation.create(i.instanceId, i))
);

export let useCreateScmRepo = scmInstallationsLoader.createExternalMutator(
  (i: DashboardInstanceScmReposCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.scm.repos.create(i.instanceId, i))
);

export type ResolveScmRepositoryInput = {
  instanceId: string;
  provider: 'github' | 'gitlab' | 'bitbucket';
  identifier: string;
};

export type ResolvedScmRepository =
  | {
      type: 'linked';
      repository: DashboardInstanceScmReposCreateOutput;
    }
  | {
      type: 'available';
      installationId: string;
      externalRepoId: string;
    }
  | {
      type: 'public';
    };

let normalizeRepositoryIdentifier = (identifier: string) =>
  identifier
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^(github\.com|gitlab\.com|bitbucket\.org)\//, '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\.git$/, '');

let identifiersMatch = (a: string, b: string) =>
  normalizeRepositoryIdentifier(a) == normalizeRepositoryIdentifier(b);

export let useResolveScmRepository = scmInstallationsLoader.createExternalMutator(
  (i: ResolveScmRepositoryInput): Promise<ResolvedScmRepository> =>
    withAuth(async sdk => {
      let after: string | undefined;

      while (true) {
        let repositories = await sdk.scm.repos.list(i.instanceId, {
          limit: 100,
          order: 'asc',
          after
        });
        let repository = repositories.items.find(
          item =>
            item.provider.type == i.provider &&
            identifiersMatch(`${item.provider.owner}/${item.provider.name}`, i.identifier)
        );
        if (repository) return { type: 'linked', repository };
        if (!repositories.pagination.hasMoreAfter) break;

        after = repositories.items.at(-1)?.id;
        if (!after) break;
      }

      after = undefined;
      while (true) {
        let installations = await sdk.scm.installation.list(i.instanceId, {
          limit: 100,
          order: 'asc',
          after
        });
        let installationAccounts = await Promise.all(
          installations.items
            .filter(installation => installation.provider == i.provider)
            .map(async installation => ({
              installation,
              accounts: (
                await sdk.scm.accounts.preview(i.instanceId, {
                  installationId: installation.id
                })
              ).accounts
            }))
        );
        let accountRepositories = await Promise.all(
          installationAccounts.flatMap(({ installation, accounts }) =>
            accounts.map(async account => ({
              installation,
              repositories: (
                await sdk.scm.repos.preview(i.instanceId, {
                  installationId: installation.id,
                  externalAccountId: account.externalId
                })
              ).repos
            }))
          )
        );
        let availableRepository = accountRepositories
          .flatMap(({ installation, repositories }) =>
            repositories.map(repository => ({ installation, repository }))
          )
          .find(
            ({ repository }) =>
              repository.provider == i.provider &&
              identifiersMatch(repository.identifier, i.identifier)
          );

        if (availableRepository) {
          return {
            type: 'available',
            installationId: availableRepository.installation.id,
            externalRepoId: availableRepository.repository.externalId
          };
        }

        if (!installations.pagination.hasMoreAfter) break;
        after = installations.items.at(-1)?.id;
        if (!after) break;
      }

      return { type: 'public' };
    })
);

export let scmReposLoader = createLoader({
  name: 'scmRepos',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceScmReposPreviewBody) =>
    withAuth(sdk => sdk.scm.repos.preview(i.instanceId, i)),
  mutators: {}
});

export let useScmRepos = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceScmReposPreviewBody
) => {
  let data = scmReposLoader.use(instanceId && query ? { instanceId, ...query } : null);

  return data;
};

export let scmAccountsLoader = createLoader({
  name: 'scmAccounts',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceScmAccountsPreviewBody) =>
    withAuth(sdk => sdk.scm.accounts.preview(i.instanceId, i)),
  mutators: {}
});

export let useScmAccounts = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceScmAccountsPreviewBody
) => {
  let data = scmAccountsLoader.use(
    instanceId && query ? { instanceId, ...query } : null
  );

  return data;
};

export let scmConnectionsLoader = createLoader({
  name: 'scmConnections',
  parents: [],
  fetch: (i: {
    instanceId: string;
    limit?: number;
    after?: string;
    before?: string;
    cursor?: string;
    order?: 'asc' | 'desc';
  }) => withAuth(sdk => sdk.scm.connections.list(i.instanceId, i)),
  mutators: {}
});

export let useScmConnections = (instanceId: string | null | undefined) => {
  return usePaginator(pagination =>
    scmConnectionsLoader.use(instanceId ? { instanceId, ...pagination } : null)
  );
};

export let useCreateScmConnection = scmConnectionsLoader.createExternalMutator(
  (i: {
    instanceId: string;
    redirectUrl?: string;
  }) =>
    withAuth(sdk =>
      sdk.scm.connections.create(i.instanceId, {
        redirectUrl: i.redirectUrl
      })
    )
);

export let scmProvidersLoader = createLoader({
  name: 'scmProviders',
  parents: [],
  fetch: (i: {
    instanceId: string;
    limit?: number;
    after?: string;
    before?: string;
    cursor?: string;
    order?: 'asc' | 'desc';
  }) => withAuth(sdk => sdk.scm.providers.list(i.instanceId, i)),
  mutators: {}
});

export let useScmProviders = (instanceId: string | null | undefined) => {
  return usePaginator(pagination =>
    scmProvidersLoader.use(instanceId ? { instanceId, ...pagination } : null)
  );
};

export let useCreateScmProvider = scmProvidersLoader.createExternalMutator(
  (i: {
    instanceId: string;
    type: 'github_enterprise' | 'gitlab_selfhosted' | 'bitbucket_data_center';
  }) =>
    withAuth(sdk =>
      sdk.scm.providers.create(i.instanceId, {
        type: i.type
      })
    )
);

export let scmManagedReposLoader = createLoader({
  name: 'scmManagedRepos',
  parents: [],
  fetch: (i: {
    instanceId: string;
    limit?: number;
    after?: string;
    before?: string;
    cursor?: string;
    order?: 'asc' | 'desc';
    id?: string | string[];
    providerId?: string | string[];
    createdAt?: {
      gt?: Date;
      lt?: Date;
    };
    updatedAt?: {
      gt?: Date;
      lt?: Date;
    };
  }) => withAuth(sdk => sdk.scm.repos.list(i.instanceId, i)),
  mutators: {}
});

export let useManagedScmRepos = (instanceId: string | null | undefined) => {
  return usePaginator(pagination =>
    scmManagedReposLoader.use(instanceId ? { instanceId, ...pagination } : null)
  );
};
