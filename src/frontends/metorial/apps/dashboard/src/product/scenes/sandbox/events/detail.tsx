import { renderWithLoader } from '@metorial/data-hooks';
import {
  useSandboxMachineEvent,
  useSandboxMachineError,
  useSandboxMachineOperation
} from '@metorial/state';
import { RenderDate, Callout, Datalist, Flex, Panel, Text, theme } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import styled from 'styled-components';
import { formatDurationBetween, formatEnumLabel } from '../lib/format';
import {
  getSandboxMachineEventCopy,
  getSandboxMachineEventSourceLabel
} from '../shared/eventCopy';

let Output = styled.pre`
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 12px;
  max-height: 360px;
  overflow: auto;
  padding: 12px;
  border-radius: 6px;
  background: ${theme.colors.gray200};
`;

let EventOperation = ({
  instanceId,
  machineId,
  operationId
}: {
  instanceId: string;
  machineId: string;
  operationId: string;
}) => {
  let operation = useSandboxMachineOperation(instanceId, machineId, operationId);
  return renderWithLoader({ operation })(({ operation }) => (
    <Box title="Operation">
      <Datalist
        items={[
          { label: 'Kind', value: formatEnumLabel(operation.data.kind) },
          { label: 'Trigger', value: formatEnumLabel(operation.data.trigger) },
          { label: 'Outcome', value: formatEnumLabel(operation.data.outcome) },
          {
            label: 'Duration',
            value: formatDurationBetween(
              operation.data.requestedAt,
              operation.data.completedAt ?? new Date()
            )
          }
        ]}
      />
      {operation.data.failure && (
        <Callout color="red">{operation.data.failure.message}</Callout>
      )}
    </Box>
  ));
};

let EventError = ({
  instanceId,
  machineId,
  errorId
}: {
  instanceId: string;
  machineId: string;
  errorId: string;
}) => {
  let error = useSandboxMachineError(instanceId, machineId, errorId);
  return renderWithLoader({ error })(({ error }) => (
    <Box title="Error">
      <Callout color="red">{error.data.message}</Callout>
      <Datalist
        items={[
          { label: 'Stage', value: formatEnumLabel(error.data.stage) },
          { label: 'Reason', value: error.data.reason },
          { label: 'Exit Code', value: error.data.exitCode ?? '—' },
          {
            label: 'Duration',
            value: error.data.durationMs == null ? '—' : `${error.data.durationMs} ms`
          }
        ]}
      />
      {error.data.stdout && <Output>{error.data.stdout}</Output>}
    </Box>
  ));
};

export let SandboxMachineEventDetail = ({
  instanceId,
  machineId,
  eventId
}: {
  instanceId: string;
  machineId: string;
  eventId: string;
}) => {
  let event = useSandboxMachineEvent(instanceId, machineId, eventId);
  return (
    <>
      <Panel.Header>
        <Panel.Title>Event Details</Panel.Title>
      </Panel.Header>
      <Panel.Content>
        {renderWithLoader({ event })(({ event }) => {
          let transition = event.data.machine ?? event.data.instance;
          return (
            <Flex direction="column" gap={20}>
              <Text size="3" weight="strong">
                {getSandboxMachineEventCopy(event.data.type).sentence}
              </Text>
              <Datalist
                items={[
                  {
                    label: 'Source',
                    value: getSandboxMachineEventSourceLabel(event.data.source)
                  },
                  {
                    label: 'Time',
                    value: <RenderDate date={event.data.occurredAt} />
                  },
                  ...(transition
                    ? [
                        {
                          label: 'Status',
                          value: `${transition.fromStatus ? formatEnumLabel(transition.fromStatus) : 'Created'} → ${formatEnumLabel(transition.toStatus)}`
                        }
                      ]
                    : [])
                ]}
              />
              {event.data.error && <Callout color="red">{event.data.error.message}</Callout>}
              {event.data.operationId && (
                <EventOperation
                  instanceId={instanceId}
                  machineId={machineId}
                  operationId={event.data.operationId}
                />
              )}
              {event.data.guestErrorId && (
                <EventError
                  instanceId={instanceId}
                  machineId={machineId}
                  errorId={event.data.guestErrorId}
                />
              )}
            </Flex>
          );
        })}
      </Panel.Content>
    </>
  );
};
