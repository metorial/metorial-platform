import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { useSearchParams } from 'react-router-dom';
import {
  providerParam,
  useLogsUsageFilters,
  UsageEventsCard,
  type LogsUsageFilterSpec
} from '../../../scenes/instanceUsage';
import { ToolCallsTable } from '../../../scenes/logsTable/toolCallsTable';

let usageFilterSpec: LogsUsageFilterSpec = {
  dimensions: { providerId: providerParam, consumerId: 'consumerId' },
  status: { param: 'status', success: ['succeeded'], error: ['failed'] },
  unsupported: [
    { param: 'agentId', label: 'agent' },
    { param: 'toolId', label: 'tool' }
  ]
};

export let ToolCallsPage = () => {
  let instance = useCurrentInstance();
  let [params] = useSearchParams();
  let { range, filter, segments, selection, picker, hint } =
    useLogsUsageFilters(usageFilterSpec);
  let providerId = params.get(providerParam) ?? undefined;

  return renderWithLoader({ instance })(({ instance }) => (
    <ToolCallsTable
      instanceId={instance.data.id}
      filters={{ providerId }}
      layout={{
        framed: true,
        toolbarEnd: picker,
        topContent: (
          <UsageEventsCard
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
