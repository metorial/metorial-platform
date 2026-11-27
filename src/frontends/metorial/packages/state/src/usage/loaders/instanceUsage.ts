import type {
  DashboardInstancesUsageSummaryQuery,
  DashboardInstancesUsageTimelineQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export let instanceUsageTimelineLoader = createLoader({
  name: 'instanceUsageTimeline',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstancesUsageTimelineQuery) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return sdk.instanceUsage.timeline(instanceId, query);
    }),
  mutators: {}
});

export let useInstanceUsageTimeline = (
  instanceId: string | null | undefined,
  query: DashboardInstancesUsageTimelineQuery | null | undefined
) => instanceUsageTimelineLoader.use(instanceId && query ? { instanceId, ...query } : null);

export let instanceUsageSummaryLoader = createLoader({
  name: 'instanceUsageSummary',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstancesUsageSummaryQuery) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return sdk.instanceUsage.summary(instanceId, query);
    }),
  mutators: {}
});

export let useInstanceUsageSummary = (
  instanceId: string | null | undefined,
  query: DashboardInstancesUsageSummaryQuery | null | undefined
) => instanceUsageSummaryLoader.use(instanceId && query ? { instanceId, ...query } : null);
