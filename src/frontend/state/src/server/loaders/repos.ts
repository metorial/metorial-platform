import {
  DashboardScmAccountsPreviewQuery,
  DashboardScmInstallationsCreateBody,
  DashboardScmInstallationsListQuery,
  DashboardScmReposCreateBody,
  DashboardScmReposPreviewQuery
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

let emptyList = {
  __typename: 'list' as const,
  items: [] as any[],
  pagination: { hasMoreAfter: false, hasMoreBefore: false }
};

let hasScm = (sdk: any): boolean => !!sdk.scm;

export let scmInstallationsLoader = createLoader({
  name: 'scmInstallations',
  parents: [],
  fetch: (i: { organizationId: string } & DashboardScmInstallationsListQuery) =>
    withAuth(sdk => {
      if (!hasScm(sdk)) return emptyList;
      return sdk.scm.installation.list(i.organizationId, i);
    }),
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
    withAuth(sdk => {
      if (!hasScm(sdk)) throw new Error('SCM feature not available');
      return sdk.scm.installation.create(i.organizationId, i);
    })
);

export let useCreateScmRepo = scmInstallationsLoader.createExternalMutator(
  (i: DashboardScmReposCreateBody & { organizationId: string }) =>
    withAuth(sdk => {
      if (!hasScm(sdk)) throw new Error('SCM feature not available');
      return sdk.scm.repos.create(i.organizationId, i);
    })
);

export let scmReposLoader = createLoader({
  name: 'scmRepos',
  parents: [],
  fetch: (i: { organizationId: string } & DashboardScmReposPreviewQuery) =>
    withAuth(sdk => {
      if (!hasScm(sdk)) return emptyList;
      return sdk.scm.repos.preview(i.organizationId, i);
    }),
  mutators: {}
});

export let useScmRepos = (
  organizationId: string | null | undefined,
  query?: DashboardScmReposPreviewQuery
) => {
  let data = scmReposLoader.use(organizationId && query ? { organizationId, ...query } : null);

  return data;
};

export let scmAccountsLoader = createLoader({
  name: 'scmAccounts',
  parents: [],
  fetch: (i: { organizationId: string } & DashboardScmAccountsPreviewQuery) =>
    withAuth(sdk => {
      if (!hasScm(sdk)) return emptyList;
      return sdk.scm.accounts.preview(i.organizationId, i);
    }),
  mutators: {}
});

export let useScmAccounts = (
  organizationId: string | null | undefined,
  query?: DashboardScmAccountsPreviewQuery
) => {
  let data = scmAccountsLoader.use(
    organizationId && query ? { organizationId, ...query } : null
  );

  return data;
};
