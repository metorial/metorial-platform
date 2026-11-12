import { DashboardInstanceConsumerDevicesListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let consumerDevicesLoader = createLoader({
  name: 'consumerDevices',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceConsumerDevicesListQuery) =>
    withAuth(sdk => sdk.consumerDevices.list(i.instanceId, i)),
  mutators: {
    revoke: ({ consumerDeviceId }: { consumerDeviceId: string }, { input: { instanceId } }) =>
      withAuth(sdk => sdk.consumerDevices.revoke(instanceId, consumerDeviceId))
  }
});

export let useConsumerDevices = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceConsumerDevicesListQuery
) => {
  let devices = usePaginator(
    pagination =>
      consumerDevicesLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null),
    instanceId ? JSON.stringify({ instanceId, ...query }) : null
  );

  return {
    ...devices,
    useRevokeMutator: devices.useMutator('revoke')
  };
};
