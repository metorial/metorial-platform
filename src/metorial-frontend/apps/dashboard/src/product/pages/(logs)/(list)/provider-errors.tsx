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
  unsupported: [
    { param: 'id', label: 'error group' },
    { param: 'sessionId', label: 'session' }
  ]
};

export let ProviderErrorsPage = () => {
  let instance = useCurrentInstance();
  let { range, filter, picker, hint } = useLogsUsageFilters(usageFilterSpec);

  return renderWithLoader({ instance })(() => (
    <ProviderErrorGroupsTable
      layout={{
        framed: true,
        toolbarEnd: picker,
        topContent: (
          <UsageEventsCard
            variant="strip"
            title="Session errors"
            info="Errors raised during sessions, stacked by error type."
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
