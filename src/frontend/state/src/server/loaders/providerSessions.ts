/*
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let providerSessionsLoader = createLoader({
  name: 'providerSessions',
  parents: [],
  fetch: (i: {
    instanceId: string;
    status?: string;
    provider_id?: string;
    provider_deployment_id?: string;
  }) => withAuth(sdk => sdk.providerSessions.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateProviderSession = providerSessionsLoader.createExternalMutator(
  (i: {
    instanceId: string;
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    providers: Array<{
      provider_deployment: any;
      provider_config?: any;
      provider_auth_config?: any;
      session_template_id?: string;
      tool_filters?: { tool_keys?: string[] };
    }>;
  }) => withAuth(sdk => sdk.providerSessions.create(i.instanceId, i)),
  { disableToast: true }
);

export let useProviderSessions = (
  instanceId: string | null | undefined,
  opts?: { status?: string; providerId?: string; providerDeploymentId?: string }
) => {
  let data = usePaginator(pagination =>
    providerSessionsLoader.use(
      instanceId
        ? {
            instanceId,
            ...pagination,
            status: opts?.status,
            provider_id: opts?.providerId,
            provider_deployment_id: opts?.providerDeploymentId
          }
        : null
    )
  );

  return data;
};

export let providerSessionLoader = createLoader({
  name: 'providerSession',
  parents: [providerSessionsLoader],
  fetch: (i: { instanceId: string; sessionId: string }) =>
    withAuth(sdk => sdk.providerSessions.get(i.instanceId, i.sessionId)),
  mutators: {
    update: (
      body: { name?: string; description?: string; metadata?: Record<string, any> },
      { input: { instanceId, sessionId } }
    ) => withAuth(sdk => sdk.providerSessions.update(instanceId, sessionId, body)),

    delete: (_, { input: { instanceId, sessionId } }) =>
      withAuth(sdk => sdk.providerSessions.delete(instanceId, sessionId))
  }
});

export let useProviderSession = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined
) => {
  let data = providerSessionLoader.use(
    instanceId && sessionId ? { instanceId, sessionId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};
*/

// Placeholder exports to prevent import errors in consuming code
export const providerSessionsLoader = null;
export const useCreateProviderSession = () => {
  throw new Error('providerSessions API has been removed. Use sdk.sessions instead.');
};
export const useProviderSessions = () => {
  throw new Error('providerSessions API has been removed. Use sdk.sessions instead.');
};
export const providerSessionLoader = null;
export const useProviderSession = () => {
  throw new Error('providerSessions API has been removed. Use sdk.sessions instead.');
};
