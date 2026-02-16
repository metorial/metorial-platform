import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useSessions } from '@metorial/state';
import { Badge, RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let ProviderSessionStatusBadge = ({ status }: { status: string }) => {
  let statusColorMap: Record<string, 'orange' | 'red' | 'blue' | 'green' | 'gray'> = {
    connected: 'blue',
    active: 'green',
    running: 'orange',
    failed: 'red',
    completed: 'blue',
    stopped: 'gray',
    disconnected: 'gray'
  };
  let statusLabelMap: Record<string, string> = {
    connected: 'Connected',
    active: 'Active',
    running: 'Running',
    failed: 'Failed',
    completed: 'Completed',
    stopped: 'Stopped',
    disconnected: 'Disconnected'
  };
  return (
    <Badge size="1" color={statusColorMap[status ?? ''] ?? 'gray'}>
      {statusLabelMap[status ?? ''] ?? status}
    </Badge>
  );
};

export let ProviderSessionsTable = ({
  instanceId,
  providerId,
  providerDeploymentId,
  status
}: {
  instanceId: string;
  providerId?: string;
  providerDeploymentId?: string;
  status?: string;
}) => {
  let instance = useCurrentInstance();
  let sessions = useSessions(instanceId, {
    providerId: providerId,
    status
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
            <ProviderSessionStatusBadge status={session.connectionStatus} />,
            <Text size="2">
              {session.providerDeployments?.length
                ? session.providerDeployments
                    .slice(0, 3)
                    .map(dep => dep.name ?? dep.id.slice(0, 8))
                    .join(', ') +
                  (session.providerDeployments.length > 3
                    ? `, +${session.providerDeployments.length - 3} more`
                    : '')
                : 'No providers'}
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
