import {
  DashboardScmAccountsPreviewQuery,
  DashboardScmInstallationsCreateBody,
  DashboardScmInstallationsListQuery,
  DashboardScmReposPreviewQuery
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let scmInstallationsLoader = createLoader({
  name: 'scmInstallations',
  parents: [],
  fetch: (i: { organizationId: string } & DashboardScmInstallationsListQuery) =>
    withAuth(sdk => sdk.scm.installation.list(i.organizationId, i)),
  mutators: {}
});

export let useScmInstallations = (
  organizationId: string | null | undefined,
  query?: DashboardScmInstallationsListQuery
) => {
  let data = usePaginator(pagination =>
    scmInstallationsLoader.use(
      organizationId ? { organizationId, ...pagination, ...query } : null
    )
  );

  return data;
};

export let useCreateScmInstallation = scmInstallationsLoader.createExternalMutator(
  (i: DashboardScmInstallationsCreateBody & { organizationId: string }) =>
    withAuth(sdk => sdk.scm.installation.create(i.organizationId, i))
);

export let scmReposLoader = createLoader({
  name: 'scmRepos',
  parents: [],
  fetch: (i: { organizationId: string } & DashboardScmReposPreviewQuery) =>
    withAuth(sdk => sdk.scm.repos.list(i.organizationId, i)),
  mutators: {}
});

export let useScmRepos = (
  organizationId: string | null | undefined,
  query?: DashboardScmReposPreviewQuery
) => {
  let data = usePaginator(pagination =>
    scmReposLoader.use(organizationId ? { organizationId, ...pagination, ...query } : null)
  );

  return data;
};

export let scmAccountsLoader = createLoader({
  name: 'scmAccounts',
  parents: [],
  fetch: (i: { organizationId: string } & DashboardScmAccountsPreviewQuery) =>
    withAuth(sdk => sdk.scm.accounts.list(i.organizationId, i)),
  mutators: {}
});

export let useScmAccounts = (
  organizationId: string | null | undefined,
  query?: DashboardScmAccountsPreviewQuery
) => {
  let data = usePaginator(pagination =>
    scmAccountsLoader.use(organizationId ? { organizationId, ...pagination, ...query } : null)
  );

  return data;
};
