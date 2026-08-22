import type {
  DashboardInstanceIntegrationsProvidersCallbackGetConfigSchemaQuery,
  DashboardInstanceIntegrationsProvidersCallbackUpsertBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { isMetorialSDKError } from '@metorial/util-endpoint';
import { withAuth } from '../../user';
import { allCallbacksLoader, callbacksLoader } from './callbacks';

type IntegrationProviderCallbackInput = {
  instanceId: string;
  integrationProviderId: string;
};

export let integrationProviderCallbackLoader = createLoader({
  name: 'integrationProviderCallback',
  parents: [callbacksLoader, allCallbacksLoader],
  fetch: async (i: IntegrationProviderCallbackInput) => {
    try {
      let callback = await withAuth(sdk =>
        sdk.integration.providers.callback.get(i.instanceId, i.integrationProviderId)
      );
      return { callback };
    } catch (error) {
      if (isMetorialSDKError(error) && error.code === 'not_found') {
        return { callback: null };
      }
      throw error;
    }
  },
  mutators: {
    upsert: (
      body: DashboardInstanceIntegrationsProvidersCallbackUpsertBody,
      { input: { instanceId, integrationProviderId } }
    ) =>
      withAuth(sdk =>
        sdk.integration.providers.callback.upsert(instanceId, integrationProviderId, body)
      ),
    delete: (_: void, { input: { instanceId, integrationProviderId } }) =>
      withAuth(sdk =>
        sdk.integration.providers.callback.delete(instanceId, integrationProviderId)
      )
  }
});

export let useIntegrationProviderCallback = (
  instanceId: string | null | undefined,
  integrationProviderId: string | null | undefined
) => {
  let data = integrationProviderCallbackLoader.use(
    instanceId && integrationProviderId ? { instanceId, integrationProviderId } : null
  );

  return {
    ...data,
    data: data.data?.callback ?? null,
    useUpsertMutator: data.useMutator('upsert'),
    useDeleteMutator: data.useMutator('delete')
  };
};

type IntegrationProviderCallbackConfigSchemaInput = IntegrationProviderCallbackInput & {
  triggerIds: DashboardInstanceIntegrationsProvidersCallbackGetConfigSchemaQuery['triggerIds'];
};

export let integrationProviderCallbackConfigSchemaLoader = createLoader({
  name: 'integrationProviderCallbackConfigSchema',
  parents: [integrationProviderCallbackLoader],
  fetch: (i: IntegrationProviderCallbackConfigSchemaInput) =>
    withAuth(sdk =>
      sdk.integration.providers.callback.getConfigSchema(
        i.instanceId,
        i.integrationProviderId,
        { triggerIds: i.triggerIds }
      )
    ),
  mutators: {}
});

export let useIntegrationProviderCallbackConfigSchema = (
  instanceId: string | null | undefined,
  integrationProviderId: string | null | undefined,
  triggerIds: readonly string[] | null | undefined
) => {
  let normalizedTriggerIds = triggerIds ? normalizeCallbackTriggerIds(triggerIds) : null;

  return integrationProviderCallbackConfigSchemaLoader.use(
    instanceId && integrationProviderId && normalizedTriggerIds?.length
      ? { instanceId, integrationProviderId, triggerIds: normalizedTriggerIds }
      : null
  );
};

export let normalizeCallbackTriggerIds = (triggerIds: readonly string[]) =>
  [...new Set(triggerIds)].sort();
