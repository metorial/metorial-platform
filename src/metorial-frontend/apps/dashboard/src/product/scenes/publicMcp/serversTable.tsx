import type {
  DashboardInstancePublicMcpServersListOutput,
  DashboardInstancePublicMcpServersListQuery
} from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  usePublicMcpServers
} from '@metorial/state';
import {
  getConstrainedEnumListFilterValue,
  Table as DashboardTable,
  TableStateProvider,
  TableStateProviderResult
} from '@metorial/table';
import { RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { PublicMcpServerStatusBadge } from './shared';

type PublicMcpServerRow = DashboardInstancePublicMcpServersListOutput['items'][number];

type PublicMcpServersTableProps = {
  instanceId: string;
  filters?: Omit<
    DashboardInstancePublicMcpServersListQuery,
    'limit' | 'after' | 'before' | 'cursor'
  >;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let usePublicMcpServersTableState: TableStateProvider<
  PublicMcpServersTableProps,
  PublicMcpServerRow,
  TableStateProviderResult<PublicMcpServerRow>
> = (props, opts) => {
  let servers = usePublicMcpServers(props.instanceId, {
    order: 'desc',
    ...props.filters,
    status: getConstrainedEnumListFilterValue(
      opts.filter.status,
      ['active', 'disabled', 'archived'],
      props.filters?.status ?? ['active', 'disabled']
    )
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

let publicMcpServersTable = new DashboardTable<PublicMcpServersTableProps, PublicMcpServerRow>(
  'public-mcp-servers'
)
  .state(usePublicMcpServersTableState)
  .columns([
    {
      id: 'status',
      isDefault: true,
      header: 'Status',
      render: server => <PublicMcpServerStatusBadge status={server.status} />
    },
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: server => (
        <div>
          <Text size="2" weight="strong">
            {server.name}
          </Text>
          <Text size="1" color="gray600">
            {server.slug}
          </Text>
        </div>
      )
    },
    {
      id: 'connectUrl',
      isDefault: true,
      header: 'Connect URL',
      render: server => <ID id={server.connectUrl} />
    },
    {
      id: 'deployment',
      isDefault: false,
      header: 'Deployment',
      render: server => <ID id={server.deployment.id} copy={false} />
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: server => <RenderDate date={server.createdAt} />
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
        { id: 'disabled', label: 'Disabled' },
        { id: 'archived', label: 'Archived' }
      ]
    }
  ])
  .link((server, props) =>
    Paths.instance.publicMcp.server(
      props.organization.data,
      props.project.data,
      props.instance.data,
      server.id
    )
  )
  .build();

export let PublicMcpServersTable = ({
  instanceId,
  filters
}: {
  instanceId: string;
  filters?: PublicMcpServersTableProps['filters'];
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return publicMcpServersTable({
    instanceId,
    filters,
    instance,
    organization,
    project,
    emptyState: 'No public MCP servers yet.'
  });
};
