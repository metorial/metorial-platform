import {
  DashboardInstanceMagicMcpServersListOutput,
  DashboardInstanceMagicMcpServersListQuery
} from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useMagicMcpServers
} from '@metorial/state';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Table as DashboardTable } from '../../../../components/table';
import { FilterPayload } from '../../../../components/table/filter';
import {
  TableStateProvider,
  TableStateProviderResult
} from '../../../../components/table/type';
import { getEnumListFilterValue, getStringFilterValue } from '../../../../lib/dataTableUtils';

type Server = DashboardInstanceMagicMcpServersListOutput['items'][number];

type MagicMcpServersTableProps = DashboardInstanceMagicMcpServersListQuery & {
  instanceId: string;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let getServerStatusFilterValue = (
  value: FilterPayload | undefined
): DashboardInstanceMagicMcpServersListQuery['status'] =>
  getEnumListFilterValue(value, ['active', 'archived', 'deleted']);

let magicServersState: TableStateProvider<
  MagicMcpServersTableProps,
  Server,
  TableStateProviderResult<Server>
> = (props, opts) => {
  let servers = useMagicMcpServers(props.instanceId, {
    order: props.order ?? 'desc',
    status: getServerStatusFilterValue(opts.filter.status) ?? props.status,
    magicMcpGroupId:
      getStringFilterValue(opts.filter.magicMcpGroupId) ?? props.magicMcpGroupId,
    consumerId: props.consumerId,
    consumerProfileId: props.consumerProfileId,
    search: opts.search ?? props.search
  });

  return {
    isLoading: servers.isLoading,
    error: servers.error,
    hasMoreAfter: servers.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: servers.data?.pagination.hasMoreBefore ?? false,
    items: servers.data?.items ?? [],
    loadNext: servers.next,
    loadPrevious: servers.previous
  };
};

let magicServersTable = new DashboardTable<MagicMcpServersTableProps, Server>(
  'magic-mcp-servers'
)
  .state(magicServersState)
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: server => (
        <div>
          <Text size="2" weight="strong">
            {server.name ?? 'Unknown Server'}
          </Text>
          {server.description && (
            <Text size="1" color="gray600">
              {server.description}
            </Text>
          )}
        </div>
      )
    },
    {
      id: 'status',
      isDefault: true,
      header: 'Status',
      render: server => (
        <Badge
          color={
            { active: 'green', archived: 'orange', deleted: 'gray' }[server.status] as any
          }
        >
          {server.status}
        </Badge>
      )
    },
    {
      id: 'aliases',
      isDefault: true,
      header: 'Aliases',
      render: server => (
        <Text size="2">
          {server.endpoints.map(endpoint => endpoint.alias).join(', ') || '-'}
        </Text>
      )
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: server => <RenderDate date={server.createdAt} />
    },
    {
      id: 'endpointCount',
      isDefault: false,
      header: 'Endpoints',
      render: server => <Text size="2">{server.endpoints.length}</Text>
    },
    {
      id: 'urls',
      isDefault: false,
      header: 'Endpoint URLs',
      render: server => (
        <Text size="2">
          {server.endpoints.map(endpoint => endpoint.url).join(', ') || '-'}
        </Text>
      )
    },
    {
      id: 'sessionTemplateId',
      isDefault: false,
      header: 'Session Template ID',
      render: server => <ID id={server.sessionTemplateId} />
    },
    {
      id: 'providerTemplateId',
      isDefault: false,
      header: 'Provider Template ID',
      render: server =>
        server.providerTemplateId ? (
          <ID id={server.providerTemplateId} />
        ) : (
          <Text size="2" color="gray600">
            -
          </Text>
        )
    },
    {
      id: 'updatedAt',
      isDefault: false,
      header: 'Updated',
      render: server => <RenderDate date={server.updatedAt} />
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Server ID',
      render: server => <ID id={server.id} />
    }
  ])
  .filters([
    {
      id: 'status',
      fields: ['status'],
      label: 'Status',
      description: 'Filter by status',
      type: 'select',
      options: [
        { id: 'active', label: 'Active' },
        { id: 'archived', label: 'Archived' },
        { id: 'deleted', label: 'Deleted' }
      ]
    },
    {
      id: 'magicMcpGroupId',
      fields: ['magicMcpGroupId'],
      label: 'Group ID',
      description: 'Filter by group ID',
      type: 'string'
    }
  ])
  .search('Search Magic MCP servers...')
  .link((server, props) =>
    Paths.instance.magicMcp.server(
      props.organization.data,
      props.project.data,
      props.instance.data,
      server.id
    )
  )
  .build();

export let MagicMcpServersTable = (
  filter: DashboardInstanceMagicMcpServersListQuery & {
    headerActions?: React.ReactNode;
  }
) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return magicServersTable({
    instanceId: instance.data!.id,
    organization,
    project,
    instance,
    ...filter,
    emptyState: 'No Magic MCP servers found.',
    headerActions: filter.headerActions ? () => filter.headerActions : undefined
  });
};

export let MagicMcpServersGrid = MagicMcpServersTable;
