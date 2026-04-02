import { createLoader } from '@metorial/data-hooks';
import { useBootWithAuth } from '../portal/client';
import { withConsumerClient } from './client';

export let consumerLoader = createLoader({
  name: 'consumer',
  parents: [],
  fetch: async (_: {}) => {
    return await withConsumerClient(client => client.profile.get());
  },
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
