import { CodeBlock } from '@metorial/code';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  useCallback,
  useCallbackEvent,
  useCallbackEvents,
  useCurrentInstance
} from '@metorial/state';
import {
  Attributes,
  Badge,
  InputDescription,
  InputLabel,
  Panel,
  RenderDate,
  Spacer,
  Text,
  Title
} from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RouterPanel } from '../routerPanel';
import { Notifications } from './logs';

export let CallbackEventsList = (p: { callbackId: string | undefined }) => {
  let instance = useCurrentInstance();
  let callback = useCallback(instance.data?.id, p.callbackId);

  let events = useCallbackEvents(instance.data?.id, {
    order: 'desc',
    callbackId: callback.data?.id
  });

  let [_, setSearchParams] = useSearchParams();

  return (
    <>
      <Title as="h2" size="5" weight="strong">
        Events
      </Title>
      <Text size="2" weight="medium" color="gray600">
        When Metorial receives a callback from the external provider an event is created. These
        are the events Metorial has received recently. After an event is processed,{' '}
        <Link to="../logs" style={{ color: 'black' }}>
          notifications
        </Link>{' '}
        will be sent to your destinations.
      </Text>
      <Spacer height={20} />

      {renderWithPagination(events)(events => (
        <>
          <Table
            headers={['Info', 'Type', 'Created']}
            data={events.data.items.map(event => ({
              data: [
                {
                  failed: <Badge color="red">Failed</Badge>,
                  pending: <Badge color="gray">Pending</Badge>,
                  succeeded: <Badge color="blue">Succeeded</Badge>,
                  retrying: <Badge color="yellow">Retrying</Badge>
                }[event.status],
                <Text size="2" weight="strong">
                  {event.type ?? 'N/A'}
                </Text>,
                <RenderDate date={event.createdAt} />
              ],
              onClick: () =>
                setSearchParams(p => {
                  p.set('event_id', event.id);
                  return p;
                })
            }))}
          />

          {events.data.items.length == 0 && (
            <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
              No events found for this callback.
            </Text>
          )}
        </>
      ))}

      <RouterPanel param="event_id" width={1000}>
        {eventId => (
          <>
            <Panel.Header>
              <Panel.Title>Event Details</Panel.Title>
            </Panel.Header>

            <Panel.Content>
              <Event eventId={eventId!} callbackId={callback.data?.id!} />
            </Panel.Content>
          </>
        )}
      </RouterPanel>
    </>
  );
};

let Event = ({ eventId, callbackId }: { eventId: string; callbackId: string }) => {
  let instance = useCurrentInstance();
  let callback = useCallback(instance.data?.id, callbackId);
  let event = useCallbackEvent(instance.data?.id, eventId);

  let payloadIncoming = useMemo(() => {
    if (!event.data) return '...';

    try {
      return JSON.stringify(JSON.parse(event.data.payloadIncoming), null, 2);
    } catch {
      return event.data.payloadIncoming;
    }
  }, [event.data]);

  let payloadOutgoing = useMemo(() => {
    if (!event.data?.payloadOutgoing) return undefined;

    try {
      return JSON.stringify(JSON.parse(event.data.payloadOutgoing), null, 2);
    } catch {
      return event.data.payloadOutgoing;
    }
  }, [event.data]);

  return renderWithLoader({ event, callback })(({ event, callback }) => (
    <>
      <Attributes
        itemWidth="350px"
        attributes={[
          {
            label: 'Type',
            content: {
              pending: <Badge color="gray">Pending</Badge>,
              succeeded: <Badge color="blue">Succeeded</Badge>,
              retrying: <Badge color="yellow">Retrying</Badge>,
              failed: <Badge color="red">Failed</Badge>
            }[event.data.status]
          },
          {
            label: 'ID',
            content: <ID id={callback.data.id} />
          },
          {
            label: 'Event Type',
            content: event.data.type || 'N/A'
          },
          {
            label: 'Created At',
            content: <RenderDate date={event.data.createdAt} />
          }
        ]}
      />

      <Spacer height={15} />

      {event.data.status == 'succeeded' && (
        <>
          <Box
            title="Notifications Sent"
            description="The notifications sent to your callback destinations for this event."
          >
            <Notifications eventId={event.data.id} />
          </Box>
          <Spacer height={15} />
        </>
      )}

      <InputLabel>Incoming Payload</InputLabel>
      <InputDescription>The payload the provider sent to Metorial</InputDescription>
      <CodeBlock language="json" code={payloadIncoming} />

      <Spacer height={15} />

      {payloadOutgoing && (
        <>
          <InputLabel>Outgoing Payload</InputLabel>
          <InputDescription>
            The payload after is has been processed by the MCP server
          </InputDescription>
          <CodeBlock language="json" code={payloadOutgoing} />
          <Spacer height={15} />
        </>
      )}

      {(event.data.status != 'succeeded' ||
        event.data.processingAttempts.some(a => a.status != 'succeeded')) && (
        <Box
          title="Processing Attempts"
          description="The attempts by the MCP server to process and normalize the event payload."
        >
          <Table
            headers={['Attempt', 'Status', 'Error Code', 'Error Message', 'Created At']}
            data={event.data.processingAttempts.map(attempt => ({
              data: [
                <Text size="2" weight="strong">
                  <span style={{ opacity: 0.5 }}>#</span>
                  {attempt.index}
                </Text>,
                {
                  succeeded: <Badge color="blue">Succeeded</Badge>,
                  failed: <Badge color="red">Failed</Badge>
                }[attempt.status],
                attempt.errorCode ?? '-',
                attempt.errorMessage ?? '-',
                <RenderDate date={attempt.createdAt} />
              ]
            }))}
          />
        </Box>
      )}
    </>
  ));
};
