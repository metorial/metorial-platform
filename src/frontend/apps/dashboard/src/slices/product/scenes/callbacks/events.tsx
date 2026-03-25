import { CodeBlock } from '@metorial/code';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { useCallbackEvent, useCallbackEvents, useCurrentInstance } from '@metorial/state';
import { Attributes, Badge, Panel, RenderDate, Spacer, Text } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RouterPanel } from '../routerPanel';

let CALLBACK_EVENTS_POLL_MS = 3000;

let formatJson = (value: unknown) => {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value);
  }
};

let getDeliveryStatusBadge = (status?: string) => {
  let color: 'blue' | 'gray' | 'red' | 'orange' =
    status === 'delivered'
      ? 'blue'
      : status === 'failed'
        ? 'red'
        : status === 'retrying'
          ? 'orange'
          : 'gray';

  return <Badge color={color}>{status ?? 'unknown'}</Badge>;
};

export let CallbackEventsList = (p: { callbackId: string | undefined }) => {
  let instance = useCurrentInstance();
  let events = useCallbackEvents(instance.data?.id, p.callbackId, {
    order: 'desc'
  });
  let [_, setSearchParams] = useSearchParams();
  let shouldPollEvents =
    !!events.data &&
    (events.data.items.length === 0 ||
      events.data.items.some(
        event => !['delivered', 'failed'].includes(event.deliveryStatus)
      ));

  useEffect(() => {
    if (!shouldPollEvents) return;

    let interval = window.setInterval(() => {
      events.refetch?.();
    }, CALLBACK_EVENTS_POLL_MS);

    return () => window.clearInterval(interval);
  }, [shouldPollEvents, events.refetch]);

  return (
    <>
      {/* <Title as="h2" size="5" weight="strong">
        Events
      </Title>
      <Text size="2" weight="medium" color="gray600">
        When a provider trigger fires, Metorial creates a callback event and then delivers
        notifications to the configured destinations.
      </Text>
      <Spacer height={20} /> */}

      {renderWithPagination(events)(events => (
        <>
          <Table
            headers={['Delivery', 'Type', 'Created']}
            data={events.data.items.map(event => ({
              data: [
                getDeliveryStatusBadge(event.deliveryStatus),
                <Text size="2" weight="strong">
                  {event.type || event.triggerKey}
                </Text>,
                <RenderDate date={event.createdAt} />
              ],
              onClick: () =>
                setSearchParams(params => {
                  params.set('event_id', event.id);
                  return params;
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
              <Event eventId={eventId!} callbackId={p.callbackId!} />
            </Panel.Content>
          </>
        )}
      </RouterPanel>
    </>
  );
};

let Event = ({ eventId, callbackId }: { eventId: string; callbackId: string }) => {
  let instance = useCurrentInstance();
  let event = useCallbackEvent(instance.data?.id, callbackId, eventId);

  let input = useMemo(() => formatJson(event.data?.input), [event.data?.input]);
  let output = useMemo(() => formatJson(event.data?.output), [event.data?.output]);

  return renderWithLoader({ event })(({ event }) => (
    <>
      <Attributes
        itemWidth="320px"
        attributes={[
          {
            label: 'Delivery Status',
            content: getDeliveryStatusBadge(event.data.deliveryStatus)
          },
          {
            label: 'Event Type',
            content: event.data.type || 'N/A'
          },
          {
            label: 'Trigger Key',
            content: event.data.triggerKey
          },
          {
            label: 'Source ID',
            content: event.data.sourceId
          },
          {
            label: 'Callback Instance ID',
            content: event.data.callbackInstanceId ? (
              <ID id={event.data.callbackInstanceId} />
            ) : (
              'N/A'
            )
          },
          {
            label: 'Created At',
            content: <RenderDate date={event.data.createdAt} />
          }
        ]}
      />

      <Spacer height={15} />

      <Box
        title="Input Payload"
        description="The raw payload captured for this callback event."
      >
        <CodeBlock language="json" code={input} />
      </Box>

      <Spacer height={15} />

      <Box
        title="Output Payload"
        description="The normalized output stored for downstream callback deliveries."
      >
        <CodeBlock language="json" code={output} />
      </Box>
    </>
  ));
};
