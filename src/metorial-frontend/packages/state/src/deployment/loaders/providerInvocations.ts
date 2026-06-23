import { DashboardInstanceProviderInvocationsListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export let providerInvocationsLoader = createLoader({
  name: 'providerInvocations',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceProviderInvocationsListQuery) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return sdk.providerInvocations.list(instanceId, query);
    }),
  mutators: {}
});

export let useProviderInvocations = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceProviderInvocationsListQuery
) => {
  let enabled = Boolean(instanceId);
  let data = providerInvocationsLoader.use(
    enabled ? { instanceId: instanceId!, ...query } : null
  );

  if (!enabled) {
    return {
      ...data,
      data: null,
      isLoading: false
    };
  }

  return data;
};

export let providerInvocationLoader = createLoader({
  name: 'providerInvocation',
  parents: [providerInvocationsLoader],
  fetch: (i: { instanceId: string; providerInvocationId: string }) =>
    withAuth(sdk => sdk.providerInvocations.get(i.instanceId, i.providerInvocationId)),
  mutators: {}
});

export let useProviderInvocation = (
  instanceId: string | null | undefined,
  providerInvocationId: string | null | undefined
) => {
  let data = providerInvocationLoader.use(
    instanceId && providerInvocationId ? { instanceId, providerInvocationId } : null
  );

  return data;
};
