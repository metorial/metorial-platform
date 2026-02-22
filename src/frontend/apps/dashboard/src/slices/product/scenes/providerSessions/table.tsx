import { DashboardInstanceSessionsListQuery } from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useSessions } from '@metorial/state';
import { RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

type SessionStatusFilter = Extract<
  DashboardInstanceSessionsListQuery['status'],
  'active' | 'archived'
>;

let normalizeSessionStatus = (status?: string): SessionStatusFilter | undefined => {
  if (status === 'active' || status === 'archived') return status;
  return undefined;
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
    status: normalizeSessionStatus(status),
    order: 'desc'
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
            <Text size="2">{session.connectionState}</Text>,
            <Text size="2">{session.providers?.length ?? 0} providers</Text>,
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
