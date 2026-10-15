import type {
  DashboardInstanceSandboxMachinesUsageSummaryOutput,
  DashboardInstanceSandboxMachinesUsageSummaryQuery,
  DashboardInstanceSandboxMachinesUsageTimelineOutput,
  DashboardInstanceSandboxMachinesUsageTimelineQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';
import { SandboxPollOptions, useSandboxPolling } from '../lib/polling';

export let sandboxMachineUsageTimelineLoader = createLoader({
  name: 'sandboxMachineUsageTimeline',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      machineId: string;
    } & DashboardInstanceSandboxMachinesUsageTimelineQuery
  ) =>
    withAuth(sdk => {
      let { instanceId, machineId, ...query } = i;
      return sdk.sandbox.machines.usage.timeline(instanceId, machineId, query);
    }),
  mutators: {}
});

export let useSandboxMachineUsageTimeline = (
  instanceId: string | null | undefined,
  machineId: string | null | undefined,
  query: DashboardInstanceSandboxMachinesUsageTimelineQuery | null | undefined,
  options?: SandboxPollOptions<DashboardInstanceSandboxMachinesUsageTimelineOutput>
) => {
  let data = sandboxMachineUsageTimelineLoader.use(
    instanceId && machineId && query ? { instanceId, machineId, ...query } : null
  );

  useSandboxPolling({
    data: data.data,
    refetch: data.refetch,
    pollInterval: options?.pollInterval
  });

  return data;
};

export let sandboxMachineUsageSummaryLoader = createLoader({
  name: 'sandboxMachineUsageSummary',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      machineId: string;
    } & DashboardInstanceSandboxMachinesUsageSummaryQuery
  ) =>
    withAuth(sdk => {
      let { instanceId, machineId, ...query } = i;
      return sdk.sandbox.machines.usage.summary(instanceId, machineId, query);
    }),
  mutators: {}
});

export let useSandboxMachineUsageSummary = (
  instanceId: string | null | undefined,
  machineId: string | null | undefined,
  query: DashboardInstanceSandboxMachinesUsageSummaryQuery | null | undefined,
  options?: SandboxPollOptions<DashboardInstanceSandboxMachinesUsageSummaryOutput>
) => {
  let data = sandboxMachineUsageSummaryLoader.use(
    instanceId && machineId && query ? { instanceId, machineId, ...query } : null
  );

  useSandboxPolling({
    data: data.data,
    refetch: data.refetch,
    pollInterval: options?.pollInterval
  });

  return data;
};
