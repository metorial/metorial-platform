import {
  DashboardInstanceAiToolDetectionsListQuery,
  DashboardInstanceAiToolsListQuery,
  DashboardInstanceAiToolsPolicyUpdateBody,
  DashboardInstanceConsumerDeviceSettingsUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let aiToolsLoader = createLoader({
  name: 'aiTools',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceAiToolsListQuery) =>
    withAuth(sdk => sdk.aiTools.list(i.instanceId, i)),
  mutators: {}
});

export let useAiTools = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceAiToolsListQuery
) => aiToolsLoader.use(instanceId ? { instanceId, ...query } : null);

export let aiToolDetectionsLoader = createLoader({
  name: 'aiToolDetections',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceAiToolDetectionsListQuery) =>
    withAuth(sdk => sdk.aiToolDetections.list(i.instanceId, i)),
  mutators: {}
});

export let useAiToolDetections = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceAiToolDetectionsListQuery
) =>
  usePaginator(
    pagination =>
      aiToolDetectionsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null),
    instanceId ? JSON.stringify({ instanceId, ...query }) : null
  );

export let allAiToolDetectionsLoader = createLoader({
  name: 'allAiToolDetections',
  parents: [],
  fetch: (
    i: { instanceId: string } & Omit<DashboardInstanceAiToolDetectionsListQuery, 'limit'>
  ) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return autoPaginate(cursor =>
        sdk.aiToolDetections.list(instanceId, { ...query, ...cursor })
      );
    }),
  mutators: {}
});

export let useAllAiToolDetections = (
  instanceId: string | null | undefined,
  query?: Omit<DashboardInstanceAiToolDetectionsListQuery, 'limit'>
) => allAiToolDetectionsLoader.use(instanceId ? { instanceId, ...query } : null);

export let aiToolLoader = createLoader({
  name: 'aiTool',
  parents: [aiToolsLoader, aiToolDetectionsLoader, allAiToolDetectionsLoader],
  fetch: (i: { instanceId: string; toolKey: string }) =>
    withAuth(sdk => sdk.aiTools.get(i.instanceId, i.toolKey)),
  mutators: {
    updatePolicy: (
      body: DashboardInstanceAiToolsPolicyUpdateBody,
      { input: { instanceId, toolKey } }
    ) => withAuth(sdk => sdk.aiTools.policy.update(instanceId, toolKey, body))
  }
});

export let useAiTool = (
  instanceId: string | null | undefined,
  toolKey: string | null | undefined
) => {
  let data = aiToolLoader.use(instanceId && toolKey ? { instanceId, toolKey } : null);

  return {
    ...data,
    useUpdatePolicyMutator: data.useMutator('updatePolicy')
  };
};

export let consumerDeviceSettingsLoader = createLoader({
  name: 'consumerDeviceSettings',
  parents: [aiToolsLoader, aiToolDetectionsLoader, allAiToolDetectionsLoader],
  fetch: (i: { instanceId: string }) =>
    withAuth(sdk => sdk.consumerDeviceSettings.get(i.instanceId)),
  mutators: {
    update: (
      body: DashboardInstanceConsumerDeviceSettingsUpdateBody,
      { input: { instanceId } }
    ) => withAuth(sdk => sdk.consumerDeviceSettings.update(instanceId, body))
  }
});

export let useConsumerDeviceSettings = (instanceId: string | null | undefined) => {
  let data = consumerDeviceSettingsLoader.use(instanceId ? { instanceId } : null);

  return {
    ...data,
    useUpdateMutator: data.useMutator('update')
  };
};
