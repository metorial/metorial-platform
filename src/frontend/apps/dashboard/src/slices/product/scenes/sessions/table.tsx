import {
  DashboardInstanceSessionsGetOutput,
  DashboardInstanceSessionsListQuery
} from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';

import { useCurrentInstance, useSessions } from '@metorial/state';
import { Badge, RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let SessionConnectionStatusBadge = ({
  connectionStatus,
  hasErrors,
  hasWarnings
}: {
  connectionStatus: DashboardInstanceSessionsGetOutput['connectionState'] | undefined;
  hasErrors?: boolean | null;
  hasWarnings?: boolean | null;
}) => {
  if (hasErrors) {
    return <Badge color="red">Error</Badge>;
  }

  if (hasWarnings) {
    return <Badge color="orange">Warning</Badge>;
  }

  let colorByState: Record<string, 'blue' | 'gray'> = {
    connected: 'blue',
    disconnected: 'gray'
  };
  let labelByState: Record<string, string> = {
    connected: 'Connected',
    disconnected: 'Disconnected'
  };

  if (!connectionStatus) {
    return <Badge color="gray">Unknown</Badge>;
  }

  return (
    <Badge color={colorByState[connectionStatus] ?? 'gray'}>
      {labelByState[connectionStatus] ?? connectionStatus}
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
            <SessionConnectionStatusBadge
              connectionStatus={session.connectionState}
              hasErrors={session.hasErrors}
              hasWarnings={session.hasWarnings}
            />,
            <Text size="2" weight="strong">
              {session.providers
                ?.map(s => s.deployment?.name ?? s.providerId ?? 'Unknown')
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
