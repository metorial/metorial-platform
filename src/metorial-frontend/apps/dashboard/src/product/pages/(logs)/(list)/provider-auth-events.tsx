import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import {
  useLogsUsageFilters,
  UsageEventsCard,
  type LogsUsageFilterSpec
} from '../../../scenes/instanceUsage';
import { ProviderAuthEventsTable } from '../../../scenes/providerAuthEvents/table';

let usageFilterSpec: LogsUsageFilterSpec = {
  dimensions: { providerId: 'providerId' },
  unsupported: [
    { param: 'providerAuthConfigId', label: 'auth config' },
    { param: 'type', label: 'event' }
  ],
  search: true
};

export let ProviderAuthEventsPage = () => {
  let instance = useCurrentInstance();
  let { range, filter, picker, hint } = useLogsUsageFilters(usageFilterSpec);

  return renderWithLoader({ instance })(() => (
    <ProviderAuthEventsTable
      linkToDetail
      layout={{
        framed: true,
        topContent: (
          <UsageEventsCard
            actions={picker}
            variant="strip"
            title="Authentications"
            info="Authentication events over time, split into succeeded and failed attempts."
            hint={hint}
            filter={filter}
            range={range}
            kinds={['auth_event']}
            labels={{ success: 'Succeeded', error: 'Failed' }}
            collapseKey="logs-auth-events"
            height={120}
          />
        )
      }}
    />
  ));
};
