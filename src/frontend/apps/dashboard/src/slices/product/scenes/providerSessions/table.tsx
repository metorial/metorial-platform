import {
  DashboardInstanceSessionsGetOutput,
  DashboardInstanceSessionsListOutput,
  DashboardInstanceSessionsListQuery
} from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSessions
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

type Session = DashboardInstanceSessionsListOutput['items'][number];

type ProviderSessionsTableProps = {
  providerId?: string;
  status?: string;
  providerDeploymentId?: string;
  providerAuthConfigId?: string;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let getSessionStatusFilterValue = (
  value: FilterPayload | undefined
): Extract<DashboardInstanceSessionsListQuery['status'], 'active' | 'archived'>[] | undefined => {
  return getEnumListFilterValue(value, ['active', 'archived']);
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
  if (hasErrors) return <Badge color="red">Error</Badge>;
  if (hasWarnings) return <Badge color="orange">Warning</Badge>;
  if (connectionStatus === 'connected') return <Badge color="blue">Connected</Badge>;
  if (connectionStatus === 'disconnected') return <Badge color="gray">Disconnected</Badge>;
  return <Badge color="gray">Unknown</Badge>;
};

let useProviderSessionsTableState: TableStateProvider<
  ProviderSessionsTableProps,
  Session,
  TableStateProviderResult<Session>
> = (
  props: ProviderSessionsTableProps,
  opts: {
    filter: Record<string, FilterPayload>;
    search?: string;
  }
) => {
  let sessions = useSessions(props.instance.data?.id, {
    order: 'desc',
    providerId:
      getStringFilterValue(opts.filter.providerId) ?? props.providerId ?? undefined,
    status: getSessionStatusFilterValue(opts.filter.status) ?? (props.status as any),
    providerDeploymentId:
      getStringFilterValue(opts.filter.providerDeploymentId) ??
      props.providerDeploymentId,
    providerAuthConfigId:
      getStringFilterValue(opts.filter.providerAuthConfigId) ?? props.providerAuthConfigId
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

let providerSessionsTable = new DashboardTable<ProviderSessionsTableProps, Session>(
  'provider-sessions'
)
  .state(useProviderSessionsTableState)
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: session => (
        <div>
          <Text size="2" weight="strong">
            {session.name ?? `Session ${session.id.slice(0, 8)}...`}
          </Text>
          {session.description && (
            <Text size="1" color="gray600">
              {session.description}
            </Text>
          )}
        </div>
      )
    },
    {
      id: 'status',
      isDefault: true,
      header: 'Status',
      render: session => (
        <SessionConnectionStatusBadge
          connectionStatus={session.connectionState}
          hasErrors={session.hasErrors}
          hasWarnings={session.hasWarnings}
        />
      )
    },
    {
      id: 'providers',
      isDefault: true,
      header: 'Providers',
      render: session => (
        <Text size="2">
          {session.providers.length} {session.providers.length === 1 ? 'provider' : 'providers'}
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
      isDefault: false,
      header: 'Updated',
      render: session => <RenderDate date={session.updatedAt} />
    },
    {
      id: 'connectionState',
      isDefault: false,
      header: 'Connection',
      render: session => <Text size="2">{session.connectionState}</Text>
    },
    {
      id: 'deploymentIds',
      isDefault: false,
      header: 'Deployment IDs',
      render: session => (
        <Text size="2">{[...new Set(session.providers.map(item => item.deployment.id))].join(', ')}</Text>
      )
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Session ID',
      render: session => <ID id={session.id} />
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
        { id: 'archived', label: 'Archived' }
      ]
    },
    {
      id: 'providerId',
      fields: ['providerId'],
      label: 'Provider ID',
      description: 'Filter by provider ID',
      type: 'string'
    },
    {
      id: 'providerDeploymentId',
      fields: ['providerDeploymentId'],
      label: 'Deployment ID',
      description: 'Filter by deployment ID',
      type: 'string'
    },
    {
      id: 'providerAuthConfigId',
      fields: ['providerAuthConfigId'],
      label: 'Auth Config ID',
      description: 'Filter by auth config ID',
      type: 'string'
    }
  ])
  .link((session, props) =>
    Paths.instance.providerSession(
      props.organization.data,
      props.project.data,
      props.instance.data,
      session.id
    )
  )
  .build();

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
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return providerSessionsTable({
    providerId,
    status,
    providerDeploymentId,
    providerAuthConfigId,
    instance,
    organization,
    project,
    emptyState: 'No sessions found.'
  });
};
