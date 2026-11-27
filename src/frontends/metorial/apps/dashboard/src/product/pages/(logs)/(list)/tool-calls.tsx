import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import {
  useLogsUsageFilters,
  UsageEventsCard,
  type LogsUsageFilterSpec
} from '../../../scenes/instanceUsage';
import { ToolCallsTable } from '../../../scenes/logsTable/toolCallsTable';

let usageFilterSpec: LogsUsageFilterSpec = {
  dimensions: { providerId: 'providerId', consumerId: 'consumerId' },
  status: { param: 'status', success: ['succeeded'], error: ['failed'] },
  unsupported: [
    { param: 'agentId', label: 'agent' },
    { param: 'toolId', label: 'tool' }
  ],
  search: true
};

export let ToolCallsPage = () => {
  let instance = useCurrentInstance();
  let { range, filter, segments, selection, picker, hint } =
    useLogsUsageFilters(usageFilterSpec);

  return renderWithLoader({ instance })(({ instance }) => (
    <ToolCallsTable
      instanceId={instance.data.id}
      layout={{
        framed: true,
        topContent: (
          <UsageEventsCard
            actions={picker}
            variant="strip"
            title="Tool calls"
            info="Tool calls over time, split into succeeded and failed calls. Click a bar to filter the list to that time range and status."
            hint={hint}
            filter={filter}
            range={range}
            selection={selection}
            kinds={['tool_call']}
            labels={{ success: 'Succeeded', error: 'Failed' }}
            segments={segments}
            linkTarget="toolCalls"
            collapseKey="logs-tool-calls"
            height={120}
          />
        )
      }}
    />
  ));
};
