import { createLoader } from '@metorial/data-hooks';
import { useBootWithAuth } from '../portal/client';
import { withSdk } from './client';

export let consumerLoader = createLoader({
  name: 'consumer',
  parents: [],
  fetch: (i: {}) => withSdk(sdk => sdk.profile.get()),
  mutators: {}
});

export let useConsumer = () => {
  let consumer = consumerLoader.use({});
  let boot = useBootWithAuth();

  return {
    ...consumer,
    useLogout: boot.useMutator('logout')
  };
};
