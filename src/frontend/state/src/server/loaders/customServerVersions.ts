import {
  DashboardInstanceCustomServersVersionsCreateBody,
  DashboardInstanceCustomServersVersionsListQuery
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader, useMutation } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let customServerVersionsLoader = createLoader({
  name: 'customServerVersions',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      customServerId: string;
    } & DashboardInstanceCustomServersVersionsListQuery
  ) => withAuth(sdk => sdk.customServers.versions.list(i.instanceId, i.customServerId, i)),
  mutators: {}
});

export let useCreateCustomServersVersion = customServerVersionsLoader.createExternalMutator(
  (
    i: DashboardInstanceCustomServersVersionsCreateBody & {
      instanceId: string;
      customServerId: string;
    }
  ) => withAuth(sdk => sdk.customServers.versions.create(i.instanceId, i.customServerId, i))
);

export let useListServerVersions = () =>
  useMutation(
    (
      i: DashboardInstanceCustomServersVersionsListQuery & {
        instanceId: string;
        customServerId: string;
      }
    ) => withAuth(sdk => sdk.customServers.versions.list(i.instanceId, i.customServerId, i))
  );

export let useCustomServersVersions = (
  instanceId: string | null | undefined,
  customServerId: string | null | undefined,
  query?: DashboardInstanceCustomServersVersionsListQuery
) => {
  let data = usePaginator(pagination =>
    customServerVersionsLoader.use(
      instanceId && customServerId
        ? { instanceId, customServerId, ...pagination, ...query }
        : null
    )
  );

  return data;
};

export let customServerVersionLoader = createLoader({
  name: 'customServerVersion',
  parents: [customServerVersionsLoader],
  fetch: (i: { instanceId: string; customServerId: string; customServerVersionId: string }) =>
    withAuth(sdk =>
      sdk.customServers.versions.get(i.instanceId, i.customServerId, i.customServerVersionId)
    ),
  mutators: {}
});

export let useCustomServersVersion = (
  instanceId: string | null | undefined,
  customServerId: string | null | undefined,
  customServerVersionId: string | null | undefined
) => {
  let data = customServerVersionLoader.use(
    instanceId && customServerVersionId && customServerId
      ? { instanceId, customServerId, customServerVersionId }
      : null
  );

  return {
    ...data
  };
};
