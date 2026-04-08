import {
  DashboardInstanceMagicMcpSessionsListOutput,
  DashboardInstanceMagicMcpSessionsListQuery
} from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useMagicMcpSessions
} from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Table as DashboardTable } from '../../../../components/table';
import {
  TableStateProvider,
  TableStateProviderResult
} from '../../../../components/table/type';

type MagicMcpSession = DashboardInstanceMagicMcpSessionsListOutput['items'][number];

type MagicMcpSessionsTableProps = DashboardInstanceMagicMcpSessionsListQuery & {
  instance: ReturnType<typeof useCurrentInstance>;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
};

let magicMcpSessionsState: TableStateProvider<
  MagicMcpSessionsTableProps,
  MagicMcpSession,
  TableStateProviderResult<MagicMcpSession>
> = props => {
  let sessions = useMagicMcpSessions(props.instance.data?.id, {
    order: props.order ?? 'desc',
    magicMcpServerId: props.magicMcpServerId
  });

  return {
    isLoading: sessions.isLoading,
    error: sessions.error,
    hasMoreAfter: sessions.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: sessions.data?.pagination.hasMoreBefore ?? false,
    items: sessions.data?.items ?? [],
    loadNext: sessions.next,
    loadPrevious: sessions.previous
  };
};

let magicMcpSessionsTable = new DashboardTable<MagicMcpSessionsTableProps, MagicMcpSession>(
  'magic-mcp-sessions'
)
  .state(magicMcpSessionsState)
  .columns([
    {
      id: 'server',
      isDefault: true,
      header: 'Server',
      render: session => (
        <div>
          <Text size="2" weight="strong">
            {session.magicMcpServer.name ?? 'Unnamed Server'}
          </Text>
          {session.magicMcpServer.description && (
            <Text size="1" color="gray600">
              {session.magicMcpServer.description}
            </Text>
          )}
        </div>
      )
    },

    {
      id: 'endpoint',
      isDefault: true,
      header: 'Endpoint',
      render: session => (
        <Text size="2">
          {session.magicMcpServer.endpoints[0]?.alias ?? 'No endpoint alias'}
        </Text>
      )
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: session => <RenderDate date={session.createdAt} />
    },
    {
      id: 'updatedAt',
      isDefault: true,
      header: 'Updated',
      render: session => <RenderDate date={session.updatedAt} />
    },
    {
      id: 'sessionId',
      isDefault: false,
      header: 'Session ID',
      render: session => <ID id={session.sessionId} />
    },
    {
      id: 'serverId',
      isDefault: false,
      header: 'Server ID',
      render: session => <ID id={session.magicMcpServer.id} />
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Magic MCP Session ID',
      render: session => <ID id={session.id} />
    }
  ])
  .link((session, props) =>
    Paths.instance.magicMcp.connection(
      props.organization.data,
      props.project.data,
      props.instance.data,
      session.id
    )
  )
  .build();

export let MagicMcpSessionsTable = (filter: DashboardInstanceMagicMcpSessionsListQuery) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return magicMcpSessionsTable({
    ...filter,
    instance,
    organization,
    project,
    emptyState: 'No Magic MCP sessions found.'
  });
};
