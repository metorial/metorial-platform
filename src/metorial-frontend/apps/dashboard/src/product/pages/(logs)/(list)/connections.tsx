import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import {
  useLogsUsageFilters,
  UsageEventsCard,
  type LogsUsageFilterSpec
} from '../../../scenes/instanceUsage';
import { SessionConnectionsTable } from '../../../scenes/logsTable/sessionConnectionsTable';

let usageFilterSpec: LogsUsageFilterSpec = {
  dimensions: { consumerId: 'consumerId' },
  unsupported: [
    { param: 'connectionState', label: 'state' },
    { param: 'agentId', label: 'agent' },
    { param: 'sessionId', label: 'session' }
  ]
};

export let SessionConnectionsPage = () => {
  let instance = useCurrentInstance();
  let { range, filter, selection, picker, hint } = useLogsUsageFilters(usageFilterSpec);

  return renderWithLoader({ instance })(({ instance }) => (
    <SessionConnectionsTable
      instanceId={instance.data.id}
      layout={{
        framed: true,
        toolbarEnd: picker,
        topContent: (
          <UsageEventsCard
            variant="strip"
            title="Connections"
            info="Connections opened over time. Click a bar to filter the list to that time range."
            hint={hint}
            filter={filter}
            range={range}
            selection={selection}
            kinds={['connection']}
            mode="count"
            countLabel="Connections"
            linkTarget="connections"
            collapseKey="logs-connections"
            height={120}
          />
        )
      }}
    />
  ));
};
