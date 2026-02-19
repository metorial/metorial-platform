import {
  DashboardInstanceSessionsGetOutput,
  DashboardInstanceSessionsListQuery
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';

import { useCurrentInstance, useSessions } from '@metorial/state';
import { Badge, RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let SessionConnectionStatusBadge = ({
  session
}: {
  session: DashboardInstanceSessionsGetOutput;
}) => {
  return (
    <Badge
      color={
        {
          connected: 'blue' as const,
          disconnected: 'gray' as const
        }[session.connectionStatus]
      }
    >
      {{
        connected: 'Connected',
        disconnected: 'Disconnected'
      }[session.connectionStatus] ?? session.connectionStatus}
    </Badge>
  );
};

export let SessionsTable = (filter: DashboardInstanceSessionsListQuery) => {
  let instance = useCurrentInstance();
  let sessions = useSessions(instance.data?.id, {
    ...filter,
    order: filter.order ?? 'desc'
  });

  return renderWithPagination(sessions)(sessions => (
    <>
      <Table
        headers={['Status', 'Deployments', 'Name', 'Created']}
        data={sessions.data.items.map(session => ({
          data: [
            <SessionConnectionStatusBadge session={session} />,
            <Text size="2" weight="strong">
              {session.providerDeployments
                ?.map(s => s.name ?? s.providerId ?? 'Unknown')
                .join(', ') || 'No deployments'}
            </Text>,
            <Text size="2">
              {session.name ?? (
                <span style={{ color: theme.colors.gray600 }}>Unnamed Session</span>
              )}
            </Text>,
            <RenderDate date={session.createdAt} />
          ],
          href: Paths.instance.session(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            session.id
          )
        }))}
      />

      {sessions.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No sessions found.
        </Text>
      )}
    </>
  ));
};
