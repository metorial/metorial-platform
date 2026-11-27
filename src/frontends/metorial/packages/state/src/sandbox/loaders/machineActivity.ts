import type {
  DashboardInstanceSandboxMachinesErrorsListOutput,
  DashboardInstanceSandboxMachinesErrorsListQuery,
  DashboardInstanceSandboxMachinesEventsListOutput,
  DashboardInstanceSandboxMachinesEventsListQuery,
  DashboardInstanceSandboxMachinesInstancesListOutput,
  DashboardInstanceSandboxMachinesInstancesListQuery,
  DashboardInstanceSandboxMachinesOperationsListOutput,
  DashboardInstanceSandboxMachinesOperationsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';
import { SandboxPollOptions, useSandboxPolling } from '../lib/polling';

export let sandboxMachineEventsLoader = createLoader({
  name: 'sandboxMachineEvents',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      machineId: string;
    } & DashboardInstanceSandboxMachinesEventsListQuery
  ) =>
    withAuth(sdk => {
      let { instanceId, machineId, ...query } = i;
      return sdk.sandbox.machines.events.list(instanceId, machineId, query);
    }),
  mutators: {}
});

export let useSandboxMachineEvents = (
  instanceId: string | null | undefined,
  machineId: string | null | undefined,
  query?: DashboardInstanceSandboxMachinesEventsListQuery | null,
  options?: SandboxPollOptions<DashboardInstanceSandboxMachinesEventsListOutput>
) => {
  let data = usePaginator(
    pagination =>
      sandboxMachineEventsLoader.use(
        instanceId && machineId && query !== null
          ? { instanceId, machineId, ...pagination, ...(query ?? {}) }
          : null
      ),
    `sandboxMachineEvents:${instanceId}:${machineId}:${JSON.stringify(query ?? {})}`
  );

  useSandboxPolling({
    data: data.data,
    refetch: data.refetch,
    pollInterval: options?.pollInterval
  });

  return data;
};

export let sandboxMachineEventLoader = createLoader({
  name: 'sandboxMachineEvent',
  parents: [],
  fetch: (i: { instanceId: string; machineId: string; eventId: string }) =>
    withAuth(sdk => sdk.sandbox.machines.events.get(i.instanceId, i.machineId, i.eventId)),
  mutators: {}
});

export let useSandboxMachineEvent = (
  instanceId: string | null | undefined,
  machineId: string | null | undefined,
  eventId: string | null | undefined
) =>
  sandboxMachineEventLoader.use(
    instanceId && machineId && eventId ? { instanceId, machineId, eventId } : null
  );

export let sandboxMachineErrorsLoader = createLoader({
  name: 'sandboxMachineErrors',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      machineId: string;
    } & DashboardInstanceSandboxMachinesErrorsListQuery
  ) =>
    withAuth(sdk => {
      let { instanceId, machineId, ...query } = i;
      return sdk.sandbox.machines.errors.list(instanceId, machineId, query);
    }),
  mutators: {}
});

export let useSandboxMachineErrors = (
  instanceId: string | null | undefined,
  machineId: string | null | undefined,
  query?: DashboardInstanceSandboxMachinesErrorsListQuery | null,
  options?: SandboxPollOptions<DashboardInstanceSandboxMachinesErrorsListOutput>
) => {
  let data = usePaginator(
    pagination =>
      sandboxMachineErrorsLoader.use(
        instanceId && machineId && query !== null
          ? { instanceId, machineId, ...pagination, ...(query ?? {}) }
          : null
      ),
    `sandboxMachineErrors:${instanceId}:${machineId}:${JSON.stringify(query ?? {})}`
  );

  useSandboxPolling({
    data: data.data,
    refetch: data.refetch,
    pollInterval: options?.pollInterval
  });

  return data;
};

export let sandboxMachineErrorLoader = createLoader({
  name: 'sandboxMachineError',
  parents: [],
  fetch: (i: { instanceId: string; machineId: string; errorId: string }) =>
    withAuth(sdk => sdk.sandbox.machines.errors.get(i.instanceId, i.machineId, i.errorId)),
  mutators: {}
});

export let useSandboxMachineError = (
  instanceId: string | null | undefined,
  machineId: string | null | undefined,
  errorId: string | null | undefined
) =>
  sandboxMachineErrorLoader.use(
    instanceId && machineId && errorId ? { instanceId, machineId, errorId } : null
  );

export let sandboxMachineOperationsLoader = createLoader({
  name: 'sandboxMachineOperations',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      machineId: string;
    } & DashboardInstanceSandboxMachinesOperationsListQuery
  ) =>
    withAuth(sdk => {
      let { instanceId, machineId, ...query } = i;
      return sdk.sandbox.machines.operations.list(instanceId, machineId, query);
    }),
  mutators: {}
});

export let useSandboxMachineOperations = (
  instanceId: string | null | undefined,
  machineId: string | null | undefined,
  query?: DashboardInstanceSandboxMachinesOperationsListQuery | null,
  options?: SandboxPollOptions<DashboardInstanceSandboxMachinesOperationsListOutput>
) => {
  let data = usePaginator(
    pagination =>
      sandboxMachineOperationsLoader.use(
        instanceId && machineId && query !== null
          ? { instanceId, machineId, ...pagination, ...(query ?? {}) }
          : null
      ),
    `sandboxMachineOperations:${instanceId}:${machineId}:${JSON.stringify(query ?? {})}`
  );

  useSandboxPolling({
    data: data.data,
    refetch: data.refetch,
    pollInterval: options?.pollInterval
  });

  return data;
};

export let sandboxMachineOperationLoader = createLoader({
  name: 'sandboxMachineOperation',
  parents: [],
  fetch: (i: { instanceId: string; machineId: string; operationId: string }) =>
    withAuth(sdk =>
      sdk.sandbox.machines.operations.get(i.instanceId, i.machineId, i.operationId)
    ),
  mutators: {}
});

export let useSandboxMachineOperation = (
  instanceId: string | null | undefined,
  machineId: string | null | undefined,
  operationId: string | null | undefined
) =>
  sandboxMachineOperationLoader.use(
    instanceId && machineId && operationId ? { instanceId, machineId, operationId } : null
  );

export let sandboxMachineInstancesLoader = createLoader({
  name: 'sandboxMachineInstances',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      machineId: string;
    } & DashboardInstanceSandboxMachinesInstancesListQuery
  ) =>
    withAuth(sdk => {
      let { instanceId, machineId, ...query } = i;
      return sdk.sandbox.machines.instances.list(instanceId, machineId, query);
    }),
  mutators: {}
});

export let useSandboxMachineInstances = (
  instanceId: string | null | undefined,
  machineId: string | null | undefined,
  query?: DashboardInstanceSandboxMachinesInstancesListQuery | null,
  options?: SandboxPollOptions<DashboardInstanceSandboxMachinesInstancesListOutput>
) => {
  let data = usePaginator(
    pagination =>
      sandboxMachineInstancesLoader.use(
        instanceId && machineId && query !== null
          ? { instanceId, machineId, ...pagination, ...(query ?? {}) }
          : null
      ),
    `sandboxMachineInstances:${instanceId}:${machineId}:${JSON.stringify(query ?? {})}`
  );

  useSandboxPolling({
    data: data.data,
    refetch: data.refetch,
    pollInterval: options?.pollInterval
  });

  return data;
};

export let sandboxMachineInstanceLoader = createLoader({
  name: 'sandboxMachineInstance',
  parents: [],
  fetch: (i: { instanceId: string; machineId: string; machineInstanceId: string }) =>
    withAuth(sdk =>
      sdk.sandbox.machines.instances.get(i.instanceId, i.machineId, i.machineInstanceId)
    ),
  mutators: {}
});

export let useSandboxMachineInstance = (
  instanceId: string | null | undefined,
  machineId: string | null | undefined,
  machineInstanceId: string | null | undefined
) =>
  sandboxMachineInstanceLoader.use(
    instanceId && machineId && machineInstanceId
      ? { instanceId, machineId, machineInstanceId }
      : null
  );
