import type { PatchOperation } from '@lowerdeck/patch';
import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

let pollingIntervalMs = 60_000;

export let organizationConfigLoader = createLoader({
  name: 'organizationConfig',
  polling: { interval: pollingIntervalMs },
  fetch: (i: { organizationId: string; selector: string }) =>
    withAuth(sdk => sdk.organizations.configs.get(i.organizationId, i.selector)),
  mutators: {
    patch: async (
      body: { operations: PatchOperation[] },
      { input: { organizationId, selector }, setOutput }
    ) => {
      let config = await withAuth(sdk =>
        sdk.organizations.configs.patch(organizationId, selector, body)
      );

      setOutput(config);

      return config;
    }
  }
});

export let useOrganizationConfig = (
  organizationId: string | null | undefined,
  selector: string | null | undefined
) => {
  let data = organizationConfigLoader.use(
    organizationId && selector ? { organizationId, selector } : null
  );

  return {
    ...data,
    usePatchMutator: data.useMutator('patch')
  };
};
