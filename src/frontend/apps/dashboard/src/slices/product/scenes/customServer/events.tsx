import {
  DashboardInstanceCustomServersEventsListQuery,
  DashboardInstanceCustomServersGetOutput
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useCustomServerEvents } from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let CustomServerEventsTable = ({
  customServer,
  filters
}: {
  customServer: DashboardInstanceCustomServersGetOutput | undefined | null;
  filters?: DashboardInstanceCustomServersEventsListQuery;
}) => {
  let instance = useCurrentInstance();
  let events = useCustomServerEvents(instance.data?.id, customServer?.id, filters);

  return renderWithLoader({ events })(({ events }) => (
    <>
      <Table
        headers={['Event', 'Message', 'Created']}
        data={events.data.items.map(event => ({
          data: [
            <Text size="2" weight="strong">
              {
                {
                  remote_connection_issue: 'Remote Connection Issue'
                }[event.type]
              }
            </Text>,
            <Text size="2" weight="strong">
              {event.message}
            </Text>,
            <RenderDate date={event.createdAt} />
          ]
        }))}
      />

      {events.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No recent events for this custom server.
        </Text>
      )}
    </>
  ));
};
