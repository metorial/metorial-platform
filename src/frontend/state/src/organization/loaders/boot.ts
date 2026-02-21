import { createLoader } from '@metorial/data-hooks';
import { withDashboardSDK } from '../../sdk';
import { redirectToAuthIfNotAuthenticated } from '../../user/auth/withAuth';

export let bootLoader = createLoader({
  name: 'boot',
  fetch: (i: {}) =>
    redirectToAuthIfNotAuthenticated(() => withDashboardSDK(sdk => sdk.dashboard.boot({}))),
  mutators: {}
});

export let useBoot = () => {
  let boot = bootLoader.use({});

  return boot;
};

export let getBoot = () => bootLoader.fetchAndReturn({});

export let getInstances = () => getBoot().then(boot => boot.instances);

export let getOrgForInstance = (instanceId: string) =>
  getBoot().then(
    boot => boot.instances.find(i => i.id === instanceId)?.organization
  );
