import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import {
  useLogsUsageFilters,
  UsageEventsCard,
  type LogsUsageFilterSpec
} from '../../../scenes/instanceUsage';
import { ProviderErrorGroupsTable } from '../../../scenes/providerErrors/groupsTable';

let usageFilterSpec: LogsUsageFilterSpec = {
  dimensions: { providerId: 'providerId' },
  errorTypeParam: 'type',
  unsupported: [{ param: 'sessionId', label: 'session' }],
  search: true
};

export let ProviderErrorsPage = () => {
  let instance = useCurrentInstance();
  let { range, filter, picker, hint } = useLogsUsageFilters(usageFilterSpec);

  return renderWithLoader({ instance })(() => (
    <ProviderErrorGroupsTable
      layout={{
        framed: true,
        topContent: (
          <UsageEventsCard
            actions={picker}
            variant="strip"
            title="Session errors"
            info="Error occurrences during sessions, stacked by error type. The table groups similar errors into one row."
            hint={hint}
            filter={filter}
            range={range}
            kinds={['session_error']}
            mode="group"
            groupBy="error_type"
            collapseKey="logs-session-errors"
            height={120}
          />
        )
      }}
    />
  ));
};
