import {
  DashboardInstanceCustomProvidersCommitsListQuery,
  DashboardInstanceCustomProvidersGetOutput
} from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useCustomServerEvents } from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let CustomServerEventsTable = ({
  customServer,
  filters
}: {
  customServer: DashboardInstanceCustomProvidersGetOutput | undefined | null;
  filters?: DashboardInstanceCustomProvidersCommitsListQuery;
}) => {
  let instance = useCurrentInstance();
  let events = useCustomServerEvents(instance.data?.instanceId, customServer?.id, filters);

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
                }[event.trigger as string ?? ''] ?? event.trigger
              }
            </Text>,
            <Text size="2" weight="strong">
              {event.error?.message ?? event.status}
            </Text>,
            <RenderDate date={event.createdAt} />
          ]
        }))}
      />

      {events.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No recent events for this provider.
        </Text>
      )}
    </>
  ));
};
