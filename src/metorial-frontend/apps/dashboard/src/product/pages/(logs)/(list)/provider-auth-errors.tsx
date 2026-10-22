import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import {
  useLogsUsageFilters,
  UsageEventsCard,
  type LogsUsageFilterSpec
} from '../../../scenes/instanceUsage';
import { ProviderAuthErrorGroupsTable } from '../../../scenes/providerAuthErrors/groupsTable';

let usageFilterSpec: LogsUsageFilterSpec = {
  dimensions: { providerId: 'providerId' },
  errorTypeParam: 'type',
  unsupported: [
    { param: 'id', label: 'error group' },
    { param: 'providerAuthConfigId', label: 'auth config' }
  ]
};

export let ProviderAuthErrorsPage = () => {
  let instance = useCurrentInstance();
  let { range, filter, picker, hint } = useLogsUsageFilters(usageFilterSpec);

  return renderWithLoader({ instance })(() => (
    <ProviderAuthErrorGroupsTable
      layout={{
        framed: true,
        toolbarEnd: picker,
        topContent: (
          <UsageEventsCard
            variant="strip"
            title="Auth errors"
            info="Authentication errors over time, stacked by error type."
            hint={hint}
            filter={filter}
            range={range}
            kinds={['auth_error']}
            mode="group"
            groupBy="error_type"
            collapseKey="logs-auth-errors"
            height={120}
          />
        )
      }}
    />
  ));
};
