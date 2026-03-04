import {
  DashboardInstanceCustomProvidersCommitsListQuery,
  DashboardInstanceCustomProvidersGetOutput
} from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useCustomProviderEvents } from '@metorial/state';
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
  let events = useCustomProviderEvents(instance.data?.id, customServer?.id, filters);

  return renderWithLoader({ events })(({ events }) => (
    <>
      <Table
        headers={['Trigger', 'Status', 'Created']}
        data={events.data.items.map(event => ({
          data: [
            <Text size="2" weight="strong">
              {{
                remote_connection_issue: 'Remote Connection Issue'
              }[(event.trigger as string) ?? ''] ?? event.trigger}
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
          No recent commits for this provider.
        </Text>
      )}
    </>
  ));
};
