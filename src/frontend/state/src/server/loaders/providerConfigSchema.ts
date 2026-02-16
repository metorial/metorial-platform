import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export let providerConfigSchemaLoader = createLoader({
  name: 'providerConfigSchema',
  parents: [],
  fetch: (i: { instanceId: string; providerDeploymentId: string }) =>
    withAuth(sdk =>
      sdk.providerDeployments.configs.getConfigSchema(i.instanceId, i.providerDeploymentId)
    ),
  mutators: {}
});

export let useProviderConfigSchema = (
  instanceId: string | null | undefined,
  providerDeploymentId: string | null | undefined
) => {
  let data = providerConfigSchemaLoader.use(
    instanceId && providerDeploymentId ? { instanceId, providerDeploymentId } : null
  );

  return data;
};
