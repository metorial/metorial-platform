import type {
  DashboardInstanceSandboxMachinesCreateBody,
  DashboardInstanceSandboxMachinesGetOutput,
  DashboardInstanceSandboxMachinesListOutput,
  DashboardInstanceSandboxMachinesListQuery,
  DashboardInstanceSandboxMachinesUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';
import { SandboxPollOptions, useSandboxPolling } from '../lib/polling';
import { isSandboxMachineBusy } from '../lib/status';
import { sandboxDiskLoader, sandboxDiskMountsLoader, sandboxDisksLoader } from './disks';
import {
  sandboxMachineErrorsLoader,
  sandboxMachineEventsLoader,
  sandboxMachineInstancesLoader,
  sandboxMachineOperationsLoader
} from './machineActivity';

let MACHINES_LIST_POLL_MS = 10_000;
let MACHINE_BUSY_POLL_MS = 2_000;
let MACHINE_IDLE_POLL_MS = 15_000;

type NoInput = void | Record<string, never>;

export let sandboxMachinesLoader = createLoader({
  name: 'sandboxMachines',
  parents: [sandboxDisksLoader],
  fetch: (i: { instanceId: string } & DashboardInstanceSandboxMachinesListQuery) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return sdk.sandbox.machines.list(instanceId, query);
    }),
  mutators: {}
});

export let useCreateSandboxMachine = sandboxMachinesLoader.createExternalMutator(
  (i: DashboardInstanceSandboxMachinesCreateBody & { instanceId: string }) =>
    withAuth(sdk => {
      let { instanceId, ...body } = i;
      return sdk.sandbox.machines.create(instanceId, body);
    })
);

export let useSandboxMachines = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceSandboxMachinesListQuery | null,
  options?: SandboxPollOptions<DashboardInstanceSandboxMachinesListOutput>
) => {
  let data = usePaginator(
    pagination =>
      sandboxMachinesLoader.use(
        instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
      ),
    `sandboxMachines:${instanceId}:${JSON.stringify(query ?? {})}`
  );

  useSandboxPolling({
    data: data.data,
    refetch: data.refetch,
    pollInterval: options?.pollInterval,
    defaultInterval: page =>
      page.items.some(isSandboxMachineBusy) ? MACHINES_LIST_POLL_MS : false
  });

  return data;
};

export let sandboxMachineLoader = createLoader({
  name: 'sandboxMachine',
  parents: [
    sandboxMachinesLoader,
    sandboxDisksLoader,
    sandboxDiskLoader,
    sandboxDiskMountsLoader,
    sandboxMachineEventsLoader,
    sandboxMachineErrorsLoader,
    sandboxMachineOperationsLoader,
    sandboxMachineInstancesLoader
  ],
  fetch: (i: { instanceId: string; machineId: string }) =>
    withAuth(sdk => sdk.sandbox.machines.get(i.instanceId, i.machineId)),
  mutators: {
    update: async (
      body: DashboardInstanceSandboxMachinesUpdateBody,
      { input: { instanceId, machineId }, setOutput }
    ) => {
      let machine = await withAuth(sdk =>
        sdk.sandbox.machines.update(instanceId, machineId, body)
      );
      setOutput(machine);

      return machine;
    },
    delete: async (_: NoInput, { input: { instanceId, machineId }, setOutput }) => {
      let machine = await withAuth(sdk => sdk.sandbox.machines.delete(instanceId, machineId));
      setOutput(machine);

      return machine;
    },
    start: async (_: NoInput, { input: { instanceId, machineId }, setOutput }) => {
      let machine = await withAuth(sdk => sdk.sandbox.machines.start(instanceId, machineId));
      setOutput(machine);

      return machine;
    },
    pause: async (_: NoInput, { input: { instanceId, machineId }, setOutput }) => {
      let machine = await withAuth(sdk => sdk.sandbox.machines.pause(instanceId, machineId));
      setOutput(machine);

      return machine;
    },
    hibernate: async (_: NoInput, { input: { instanceId, machineId }, setOutput }) => {
      let machine = await withAuth(sdk =>
        sdk.sandbox.machines.hibernate(instanceId, machineId)
      );
      setOutput(machine);

      return machine;
    },
    restart: async (_: NoInput, { input: { instanceId, machineId }, setOutput }) => {
      let machine = await withAuth(sdk => sdk.sandbox.machines.restart(instanceId, machineId));
      setOutput(machine);

      return machine;
    },
    touch: async (_: NoInput, { input: { instanceId, machineId }, setOutput }) => {
      let machine = await withAuth(sdk => sdk.sandbox.machines.touch(instanceId, machineId));
      setOutput(machine);

      return machine;
    }
  }
});

export let useSandboxMachine = (
  instanceId: string | null | undefined,
  machineId: string | null | undefined,
  options?: SandboxPollOptions<DashboardInstanceSandboxMachinesGetOutput>
) => {
  let data = sandboxMachineLoader.use(
    instanceId && machineId ? { instanceId, machineId } : null
  );

  useSandboxPolling({
    data: data.data,
    refetch: data.refetch,
    pollInterval: options?.pollInterval,
    defaultInterval: machine => {
      if (machine.status == 'terminated') return false;

      return isSandboxMachineBusy(machine) ? MACHINE_BUSY_POLL_MS : MACHINE_IDLE_POLL_MS;
    }
  });

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete'),
    useStartMutator: data.useMutator('start'),
    usePauseMutator: data.useMutator('pause'),
    useHibernateMutator: data.useMutator('hibernate'),
    useRestartMutator: data.useMutator('restart'),
    useTouchMutator: data.useMutator('touch')
  };
};

export let useStartSandboxMachineFromList = sandboxMachineLoader.createExternalMutator(
  (input: { instanceId: string; machineId: string }) =>
    withAuth(sdk => sdk.sandbox.machines.start(input.instanceId, input.machineId))
);

export let usePauseSandboxMachineFromList = sandboxMachineLoader.createExternalMutator(
  (input: { instanceId: string; machineId: string }) =>
    withAuth(sdk => sdk.sandbox.machines.pause(input.instanceId, input.machineId))
);

export let useDeleteSandboxMachineFromList = sandboxMachineLoader.createExternalMutator(
  (input: { instanceId: string; machineId: string }) =>
    withAuth(sdk => sdk.sandbox.machines.delete(input.instanceId, input.machineId))
);
