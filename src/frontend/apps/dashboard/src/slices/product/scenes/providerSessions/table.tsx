import {
  DashboardInstanceSessionsGetOutput,
  DashboardInstanceSessionsListQuery
} from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useSessions } from '@metorial/state';
import { Badge, RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

type SessionStatusFilter = Extract<
  DashboardInstanceSessionsListQuery['status'],
  'active' | 'archived'
>;

let normalizeSessionStatus = (status?: string): SessionStatusFilter | undefined => {
  if (status === 'active' || status === 'archived') return status;
  return undefined;
};

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

export let ProviderSessionsTable = ({
  providerId,
  status,
  providerDeploymentId,
  providerAuthConfigId
}: {
  providerId?: string;
  status?: string;
  providerDeploymentId?: string;
  providerAuthConfigId?: string;
}) => {
  let instance = useCurrentInstance();
  let sessions = useSessions(instance.data?.id, {
    providerId: providerId,
    status: normalizeSessionStatus(status),
    order: 'desc',
    providerDeploymentId,
    providerAuthConfigId
  });

  return renderWithPagination(sessions)(sessions => (
    <>
      <Table
        headers={['Name', 'Status', 'Providers', 'Created']}
        data={sessions.data.items.map(session => ({
          data: [
            <Text size="2" weight="strong">
              {session.name ?? (
                <span style={{ color: theme.colors.gray600 }}>
                  Session {session.id.slice(0, 8)}...
                </span>
              )}
              {session.description && (
                <Text size="2" color="gray600">
                  {session.description.slice(0, 60)}
                  {session.description.length > 60 ? '...' : ''}
                </Text>
              )}
            </Text>,
            <SessionConnectionStatusBadge
              connectionStatus={session.connectionState}
              hasErrors={session.hasErrors}
              hasWarnings={session.hasWarnings}
            />,
            <Text size="2">
              {session.providers?.length ?? 0}{' '}
              {(session.providers?.length ?? 0) === 1 ? 'provider' : 'providers'}
            </Text>,
            <RenderDate date={session.createdAt} />
          ],
          href: Paths.instance.providerSession(
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
