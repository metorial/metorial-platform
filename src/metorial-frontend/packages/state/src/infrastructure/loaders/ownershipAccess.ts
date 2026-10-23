import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export let ownershipAccessLoader = createLoader({
  name: 'ownershipAccess',
  parents: [],
  fetch: (i: { instanceId: string }) => withAuth(sdk => sdk.ownershipAccess.get(i.instanceId)),
  mutators: {}
});

export let useOwnershipAccess = (instanceId: string | null | undefined) =>
  ownershipAccessLoader.use(instanceId ? { instanceId } : null);
