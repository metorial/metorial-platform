import {
  DashboardInstanceScmAccountsPreviewBody,
  DashboardInstanceScmInstallationCreateBody,
  DashboardInstanceScmInstallationListQuery,
  DashboardInstanceScmReposCreateBody,
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
    type: 'github_enterprise' | 'gitlab_selfhosted';
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
