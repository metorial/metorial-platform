import { CodeBlock } from '@metorial/code';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  useCallback,
  useCallbackEvent,
  useCallbackEvents,
  useCurrentInstance,
  useServerDeployment
} from '@metorial/state';
import { Attributes, Badge, Panel, RenderDate, Spacer, Text } from '@metorial/ui';
import { ID, Table } from '@metorial/ui-product';
import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { RouterPanel } from '../../../../scenes/routerPanel';

export let CallbackEventsPage = () => {
  let { serverDeploymentId } = useParams();
  let instance = useCurrentInstance();
  let deployment = useServerDeployment(instance.data?.id, serverDeploymentId);
  let callback = useCallback(instance.data?.id, deployment.data?.callback?.id);

  let events = useCallbackEvents(instance.data?.id, callback.data?.id, {
    order: 'desc'
  });

  let [_, setSearchParams] = useSearchParams();

  return (
    <>
      {renderWithPagination(events)(events => (
        <>
          <Table
            headers={['Info', 'Server', 'Created']}
            data={events.data.items.map(event => ({
              data: [
                {
                  failed: <Badge color="red">Failed</Badge>,
                  pending: <Badge color="gray">Pending</Badge>,
                  succeeded: <Badge color="blue">Succeeded</Badge>,
                  retrying: <Badge color="yellow">Retrying</Badge>
                }[event.status],
                <Text size="2" weight="strong">
                  {event.id}
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
              <Event eventId={eventId!} />
            </Panel.Content>
          </>
        )}
      </RouterPanel>
    </>
  );
};

let Event = ({ eventId }: { eventId: string }) => {
  let { serverDeploymentId } = useParams();
  let instance = useCurrentInstance();
  let deployment = useServerDeployment(instance.data?.id, serverDeploymentId);
  let callback = useCallback(instance.data?.id, deployment.data?.callback?.id);
  let event = useCallbackEvent(instance.data?.id, callback.data?.id, eventId);

  let content = useMemo(() => {
    if (!event.data) return '...';

    try {
      return JSON.stringify(JSON.parse(event.data.payload), null, 2);
    } catch {
      return event.data.payload;
    }
  }, [event.data]);

  return renderWithLoader({ event, callback })(({ event, callback }) => (
    <>
      <Attributes
        itemWidth="250px"
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
            label: 'Created At',
            content: <RenderDate date={event.data.createdAt} />
          }
        ]}
      />

      <Spacer height={15} />

      <CodeBlock language="json" code={content} />

      <Spacer height={15} />

      <Table
        headers={['Attempt', 'Status', 'Error Code', 'Error Message', 'Created At']}
        data={event.data.attempts.map(attempt => ({
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
    </>
  ));
};
