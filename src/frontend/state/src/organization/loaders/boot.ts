import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export let bootLoader = createLoader({
  name: 'boot',
  fetch: (i: {}) => withAuth(sdk => sdk.dashboard.boot({})),
  mutators: {}
});

export let useBoot = () => {
  let boot = bootLoader.use({});

  return boot;
};

export let getBoot = () => bootLoader.fetchAndReturn({});

export let getInstances = () => getBoot().then(boot => boot.instances);

export let getOrgForInstance = (instanceId: string) =>
  getBoot().then(boot => boot.instances.find(i => i.id === instanceId)?.organization);
