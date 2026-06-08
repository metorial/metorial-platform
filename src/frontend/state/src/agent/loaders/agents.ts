import {
  DashboardInstanceAgentsInstancesListQuery,
  DashboardInstanceAgentsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let agentsLoader = createLoader({
  name: 'agents',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceAgentsListQuery) =>
    withAuth(sdk => sdk.agents.list(i.instanceId, i)),
  mutators: {}
});

export let useAgents = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceAgentsListQuery
) => {
  return usePaginator(pagination =>
    agentsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );
};

export let agentLoader = createLoader({
  name: 'agent',
  parents: [agentsLoader],
  fetch: (i: { instanceId: string; agentId: string }) =>
    withAuth(sdk => sdk.agents.get(i.instanceId, i.agentId)),
  mutators: {}
});

export let useAgent = (
  instanceId: string | null | undefined,
  agentId: string | null | undefined
) => {
  return agentLoader.use(instanceId && agentId ? { instanceId, agentId } : null);
};

export let agentInstancesLoader = createLoader({
  name: 'agentInstances',
  parents: [agentsLoader, agentLoader],
  fetch: (
    i: {
      instanceId: string;
      agentId: string;
    } & DashboardInstanceAgentsInstancesListQuery
  ) => withAuth(sdk => sdk.agents.instances.list(i.instanceId, i.agentId, i)),
  mutators: {}
});

export let useAgentInstances = (
  instanceId: string | null | undefined,
  agentId: string | null | undefined,
  query?: DashboardInstanceAgentsInstancesListQuery
) => {
  return usePaginator(pagination =>
    agentInstancesLoader.use(
      instanceId && agentId ? { instanceId, agentId, ...pagination, ...query } : null
    )
  );
};

export let agentInstanceLoader = createLoader({
  name: 'agentInstance',
  parents: [agentInstancesLoader, agentLoader],
  fetch: (i: { instanceId: string; agentId: string; agentInstanceId: string }) =>
    withAuth(sdk => sdk.agents.instances.get(i.instanceId, i.agentId, i.agentInstanceId)),
  mutators: {}
});

export let useAgentInstance = (
  instanceId: string | null | undefined,
  agentId: string | null | undefined,
  agentInstanceId: string | null | undefined
) => {
  return agentInstanceLoader.use(
    instanceId && agentId && agentInstanceId ? { instanceId, agentId, agentInstanceId } : null
  );
};
