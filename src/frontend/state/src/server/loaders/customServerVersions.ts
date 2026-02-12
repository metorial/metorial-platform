import {
  DashboardInstanceCustomProvidersVersionsCreateBody,
  DashboardInstanceCustomProvidersVersionsListQuery
} from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { createLoader, useMutation } from '@metorial/data-hooks';
import useInterval from 'use-interval';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let customServerVersionsLoader = createLoader({
  name: 'customServerVersions',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      customServerId: string;
    } & DashboardInstanceCustomProvidersVersionsListQuery
  ) => withAuth(sdk => sdk.customProviders.versions.list(i.instanceId, i.customServerId, i)),
  mutators: {}
});

export let useCreateCustomServerVersion = customServerVersionsLoader.createExternalMutator(
  (
    i: DashboardInstanceCustomProvidersVersionsCreateBody & {
      instanceId: string;
      customServerId: string;
    }
  ) => withAuth(sdk => sdk.customProviders.versions.create(i.instanceId, i.customServerId, i))
);

export let useListServerVersions = () =>
  useMutation(
    (
      i: DashboardInstanceCustomProvidersVersionsListQuery & {
        instanceId: string;
        customServerId: string;
      }
    ) => withAuth(sdk => sdk.customProviders.versions.list(i.instanceId, i.customServerId, i))
  );

export let useCustomServerVersions = (
  instanceId: string | null | undefined,
  customServerId: string | null | undefined,
  query?: DashboardInstanceCustomProvidersVersionsListQuery
) => {
  let data = usePaginator(pagination =>
    customServerVersionsLoader.use(
      instanceId && customServerId
        ? { instanceId, customServerId, ...pagination, ...query }
        : null
    )
  );

  useInterval(() => {
    let hasDeploying = data.data?.items.some((i: { status: string | null }) => i.status == 'deploying');
    if (!hasDeploying) return;

    data.refetch();
  }, 1000 * 5);

  return data;
};

export let customServerVersionLoader = createLoader({
  name: 'customServerVersion',
  parents: [customServerVersionsLoader],
  fetch: (i: { instanceId: string; customServerId: string; customServerVersionId: string }) =>
    withAuth(sdk =>
      sdk.customProviders.versions.get(i.instanceId, i.customServerId, i.customServerVersionId)
    ),
  mutators: {}
});

export let useCustomServerVersion = (
  instanceId: string | null | undefined,
  customServerId: string | null | undefined,
  customServerVersionId: string | null | undefined
) => {
  let data = customServerVersionLoader.use(
    instanceId && customServerVersionId && customServerId
      ? { instanceId, customServerId, customServerVersionId }
      : null
  );

  useInterval(() => {
    let hasDeploying = data.data?.status == 'deploying';
    if (!hasDeploying) return;

    data.refetch();
  }, 1000);

  return {
    ...data
  };
};
