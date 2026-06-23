import {
  DashboardInstanceConsumersCreateBody,
  DashboardInstanceConsumersListQuery,
  DashboardInstanceConsumersProfilesListQuery,
  DashboardInstanceConsumersUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let consumersLoader = createLoader({
  name: 'consumers',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceConsumersListQuery) =>
    withAuth(sdk => sdk.consumers.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateConsumer = consumersLoader.createExternalMutator(
  (i: DashboardInstanceConsumersCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.consumers.create(i.instanceId, i)),
  { disableToast: true }
);

export let useConsumers = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceConsumersListQuery
) => {
  return usePaginator(
    pagination =>
      consumersLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null),
    instanceId && query ? JSON.stringify({ instanceId, ...query }) : instanceId
  );
};

export let consumerLoader = createLoader({
  name: 'consumer',
  parents: [consumersLoader],
  fetch: (i: { instanceId: string; consumerId: string }) =>
    withAuth(sdk => sdk.consumers.get(i.instanceId, i.consumerId)),
  mutators: {
    update: (
      body: DashboardInstanceConsumersUpdateBody,
      { input: { instanceId, consumerId } }
    ) => withAuth(sdk => sdk.consumers.update(instanceId, consumerId, body))
  }
});

export let useConsumer = (
  instanceId: string | null | undefined,
  consumerId: string | null | undefined
) => {
  let data = consumerLoader.use(instanceId && consumerId ? { instanceId, consumerId } : null);

  return {
    ...data,
    useUpdateMutator: data.useMutator('update')
  };
};

export let consumerProfilesLoader = createLoader({
  name: 'consumerProfiles',
  parents: [consumerLoader],
  fetch: (
    i: { instanceId: string; consumerId: string } & DashboardInstanceConsumersProfilesListQuery
  ) => withAuth(sdk => sdk.consumers.profiles.list(i.instanceId, i.consumerId, i)),
  mutators: {}
});

export let useConsumerProfiles = (
  instanceId: string | null | undefined,
  consumerId: string | null | undefined,
  query?: DashboardInstanceConsumersProfilesListQuery
) => {
  return usePaginator(
    pagination =>
      consumerProfilesLoader.use(
        instanceId && consumerId ? { instanceId, consumerId, ...pagination, ...query } : null
      ),
    instanceId && consumerId && query
      ? JSON.stringify({ instanceId, consumerId, ...query })
      : `${instanceId ?? 'none'}:${consumerId ?? 'none'}`
  );
};
