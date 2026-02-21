import {
  DashboardInstanceScmAccountsPreviewBody,
  DashboardInstanceScmInstallationCreateBody,
  DashboardInstanceScmInstallationListQuery,
  DashboardInstanceScmReposCreateBody,
  DashboardInstanceScmReposPreviewBody
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
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
