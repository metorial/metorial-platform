import { createLoader } from '@metorial/data-hooks';
import { DashboardUsageTimelineQuery } from '@metorial/generated/src/mt_2025_01_01_dashboard';
import { withAuth } from '../../user';

export let usageLoader = createLoader({
  name: 'usage',
  parents: [],
  fetch: (i: DashboardUsageTimelineQuery & { organizationId: string }) =>
    withAuth(sdk => sdk.usage.timeline(i.organizationId, i)),
  mutators: {}
});

export let useUsage = (
  organizationId: string | null | undefined,
  input: DashboardUsageTimelineQuery | null | undefined
) => {
  let usage = usageLoader.use(organizationId && input ? { ...input, organizationId } : null);

  return usage;
};
