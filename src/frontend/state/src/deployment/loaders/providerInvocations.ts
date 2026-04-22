import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export let providerInvocationLoader = createLoader({
  name: 'providerInvocation',
  parents: [],
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
