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
