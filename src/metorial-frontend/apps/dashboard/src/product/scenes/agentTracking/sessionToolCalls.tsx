import type { DashboardInstanceAgentTrackingSessionsToolCallsListOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { StatusBadge } from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useAgentTrackingSessionToolCalls } from '@metorial/state';
import { Flex, RenderDate, Text } from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { useInstanceContext } from '../../lib/dataList';
import { toolCallLinkQuery, toolCallStatus } from '../logsTable/toolCallParts';
import { agentTrackingErrorFor, agentTrackingErrorStatus } from './errorState';
import { sessionToolCallNotes } from './toolCallLinks';

let boxTitle = 'Metorial Tool Calls';

type SessionToolCalls = DashboardInstanceAgentTrackingSessionsToolCallsListOutput;

let ToolCallsList = ({ toolCalls }: { toolCalls: SessionToolCalls }) => {
  let ctx = useInstanceContext();
  let notes = sessionToolCallNotes(toolCalls);

  return (
    <Box title={boxTitle}>
      <Flex direction="column" gap={12}>
        <Table
          headers={['Tool', 'Provider', 'Status', 'Time']}
          data={toolCalls.items.map(item => ({
            data: [
              <Flex key="tool" direction="column" gap={2}>
                <Text as="span" size="2" weight="medium">
                  {item.toolCall.tool.name}
                </Text>
                <Text as="span" size="1" color="gray600">
                  {item.toolCall.tool.key}
                </Text>
              </Flex>,
              item.toolCall.provider.name,
              <StatusBadge
                key="status"
                status={item.toolCall.status}
                descriptor={toolCallStatus}
              />,
              <RenderDate key="time" date={item.occurredAt} />
            ],
            href: Paths.instance.providerSession(
              ctx.organization,
              ctx.project,
              ctx.instance,
              item.toolCall.sessionId,
              toolCallLinkQuery(item.toolCall)
            )
          }))}
        />

        {notes.map(note => (
          <Text key={note} size="1" color="gray600">
            {note}
          </Text>
        ))}
      </Flex>
    </Box>
  );
};

export let SessionToolCallsBox = ({
  instanceId,
  sessionId
}: {
  instanceId: string;
  sessionId: string;
}) => {
  let toolCalls = useAgentTrackingSessionToolCalls(instanceId, sessionId);

  return renderWithLoader(
    { toolCalls },
    {
      loading: () => null,
      error: error =>
        agentTrackingErrorStatus(error) == 403 ? null : (
          <Box title={boxTitle}>{agentTrackingErrorFor(toolCalls)(error)}</Box>
        )
    }
  )(({ toolCalls }) =>
    toolCalls.data.items.length ? <ToolCallsList toolCalls={toolCalls.data} /> : null
  );
};
