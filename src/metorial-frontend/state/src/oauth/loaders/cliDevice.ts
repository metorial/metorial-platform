import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export let cliDevicesLoader = createLoader({
  name: 'cliDevices',
  fetch: (i: { organizationId: string }) =>
    withAuth(sdk => sdk.oauth.cliDevices.list(i.organizationId)),
  mutators: {}
});

export let cliDeviceLoader = createLoader({
  name: 'cliDevice',
  parents: [cliDevicesLoader],
  fetch: (i: { organizationId: string; cliDeviceId: string }) =>
    withAuth(sdk => sdk.oauth.cliDevices.get(i.organizationId, i.cliDeviceId)),
  mutators: {}
});

export let useCliDevices = (organizationId: string | null | undefined) => {
  return cliDevicesLoader.use(organizationId ? { organizationId } : null);
};

export let useCliDevice = (
  organizationId: string | null | undefined,
  cliDeviceId: string | null | undefined
) => {
  return cliDeviceLoader.use(
    organizationId && cliDeviceId ? { organizationId, cliDeviceId } : null
  );
};
