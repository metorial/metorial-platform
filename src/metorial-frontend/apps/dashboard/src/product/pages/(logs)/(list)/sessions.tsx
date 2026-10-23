import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import {
  useLogsUsageFilters,
  UsageEventsCard,
  type LogsUsageFilterSpec
} from '../../../scenes/instanceUsage';
import { ProviderSessionsTable } from '../../../scenes/providerSessions/table';

let usageFilterSpec: LogsUsageFilterSpec = {
  dimensions: {
    providerId: 'providerId',
    consumerId: 'consumerId',
    deploymentId: 'providerDeploymentId'
  },
  unsupported: [
    { param: 'status', label: 'status' },
    { param: 'agentId', label: 'agent' },
    { param: 'actorId', label: 'actor' },
    { param: 'identityId', label: 'identity' },
    { param: 'providerAuthConfigId', label: 'auth config' },
    { param: 'providerConfigId', label: 'config' }
  ],
  search: true
};

export let SessionsPage = () => {
  let instance = useCurrentInstance();
  let { range, filter, selection, picker, hint } = useLogsUsageFilters(usageFilterSpec);

  return renderWithLoader({ instance })(() => (
    <ProviderSessionsTable
      layout={{
        framed: true,
        topContent: (
          <UsageEventsCard
            actions={picker}
            variant="strip"
            title="Sessions"
            info="Sessions created over time. Click a bar to filter the list to that time range."
            hint={hint}
            filter={filter}
            range={range}
            selection={selection}
            kinds={['session']}
            mode="count"
            countLabel="Sessions"
            linkTarget="sessions"
            collapseKey="logs-sessions"
            height={120}
          />
        )
      }}
    />
  ));
};
