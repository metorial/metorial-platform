import {
  DashboardInstanceIdentitiesListOutput,
  DashboardInstanceIdentitiesListQuery
} from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDeleteIdentity,
  useIdentities
} from '@metorial/state';
import { Badge, RenderDate, Text, confirm } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiDeleteBinLine } from '@remixicon/react';
import { useState } from 'react';
import { Table as DashboardTable } from '../../../../components/table';
import { FilterPayload } from '../../../../components/table/filter';
import {
  getEnumListFilterValue,
  getStringFilterValue
} from '../../../../lib/dataTableUtils';

type Identity = DashboardInstanceIdentitiesListOutput['items'][number];

type IdentityFilters = Omit<
  DashboardInstanceIdentitiesListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

type IdentitiesTableProps = {
  instanceId: string;
  filters?: IdentityFilters;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let getIdentityStatusColor = (status: Identity['status']) => {
  if (status === 'active') return 'green';
  if (status === 'archived') return 'orange';
  return 'gray';
};

let getStatusFilterValue = (
  value: FilterPayload | undefined
): DashboardInstanceIdentitiesListQuery['status'] => {
  return getEnumListFilterValue(value, ['active', 'archived', 'deleted']);
};

let useIdentitiesTableState = (
  props: IdentitiesTableProps,
  opts: {
    filter: Record<string, FilterPayload>;
    search?: string;
  }
) => {
  let identities = useIdentities(props.instanceId, {
    order: 'desc',
    ...props.filters,
    status: getStatusFilterValue(opts.filter.status) ?? props.filters?.status,
    id: getStringFilterValue(opts.filter.id) ?? props.filters?.id,
    agentId: getStringFilterValue(opts.filter.agentId) ?? props.filters?.agentId,
    actorId: getStringFilterValue(opts.filter.actorId) ?? props.filters?.actorId,
    search: opts.search ?? props.filters?.search
  });

  return {
    isLoading: identities.isLoading,
    error: identities.error,
    hasMoreAfter: identities.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: identities.data?.pagination.hasMoreBefore ?? false,
    items: identities.data?.items ?? [],
    loadNext: identities.next,
    loadPrevious: identities.previous
  };
};

let useIdentitiesTableHookState = (
  _: ReturnType<typeof useIdentitiesTableState>,
  props: IdentitiesTableProps
) => {
  let deleteIdentity = useDeleteIdentity();
  let [loadingIds, setLoadingIds] = useState<string[]>([]);

  return {
    deleteIdentity,
    instanceId: props.instanceId,
    loadingIds,
    setLoadingIds
  };
};

let deleteIdentityImmediately = async (
  identity: Identity,
  state: ReturnType<typeof useIdentitiesTableHookState>
) => {
  state.setLoadingIds((current: string[]) => [...new Set([...current, identity.id])]);

  try {
    await state.deleteIdentity.mutate({
      instanceId: state.instanceId,
      identityId: identity.id
    });
  } finally {
    state.setLoadingIds((current: string[]) => current.filter(id => id != identity.id));
  }
};

let identitiesTable = new DashboardTable<IdentitiesTableProps, Identity>('identities')
  .state(useIdentitiesTableState)
  .hookState(useIdentitiesTableHookState)
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: (identity: Identity) => (
        <div>
          <Text size="2" weight="strong">
            {identity.name ?? 'Unnamed'}
          </Text>
          {identity.description && (
            <Text size="1" color="gray600">
              {identity.description}
            </Text>
          )}
        </div>
      )
    },
    {
      id: 'owner',
      isDefault: true,
      header: 'Owner',
      render: (identity: Identity) => (
        <div>
          <Text size="2">{identity.owner.actor.name}</Text>
          <Text size="1" color="gray600">
            {identity.owner.actor.type}
          </Text>
        </div>
      )
    },
    {
      id: 'status',
      isDefault: false,
      header: 'Status',
      render: (identity: Identity) => (
        <Badge color={getIdentityStatusColor(identity.status)}>{identity.status}</Badge>
      )
    },
    {
      id: 'ownerActorId',
      isDefault: false,
      header: 'Owner Actor ID',
      render: (identity: Identity) => <ID id={identity.owner.actor.id} />
    },
    {
      id: 'ownerAgentId',
      isDefault: false,
      header: 'Owner Agent ID',
      render: (identity: Identity) =>
        identity.owner.actor.agentId ? (
          <ID id={identity.owner.actor.agentId} />
        ) : (
          <Text size="2" color="gray600">
            -
          </Text>
        )
    },
    {
      id: 'credentials',
      isDefault: false,
      header: 'Credentials',
      render: (identity: Identity) => <Text size="2">{identity.credentials.length}</Text>
    },
    {
      id: 'delegationConfigId',
      isDefault: false,
      header: 'Delegation Config',
      render: (identity: Identity) =>
        identity.delegationConfigId ? (
          <ID id={identity.delegationConfigId} />
        ) : (
          <Text size="2" color="gray600">
            -
          </Text>
        )
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: (identity: Identity) => <RenderDate date={identity.createdAt} />
    },
    {
      id: 'updatedAt',
      isDefault: false,
      header: 'Updated',
      render: (identity: Identity) => <RenderDate date={identity.updatedAt} />
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Identity ID',
      render: (identity: Identity) => <ID id={identity.id} />
    }
  ] as any)
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
      id: 'id',
      fields: ['id'],
      label: 'Identity ID',
      description: 'Filter by identity ID',
      type: 'string'
    },
    {
      id: 'actorId',
      fields: ['actorId'],
      label: 'Actor ID',
      description: 'Filter by actor ID',
      type: 'string'
    },
    {
      id: 'agentId',
      fields: ['agentId'],
      label: 'Agent ID',
      description: 'Filter by agent ID',
      type: 'string'
    }
  ])
  .search('Search identities...')
  .actions({
    deleteImmediate: async (identities, state) => {
      let identity = identities[0];
      if (!identity) return;

      await deleteIdentityImmediately(identity, state);
    },
    delete: async (identities, state) => {
      let identity = identities[0];
      if (!identity) return;

      confirm({
        title: 'Delete identity',
        description: `Are you sure you want to delete ${identity.name ?? 'this identity'}?`,
        confirmText: 'Delete',
        onConfirm: async () => {
          await deleteIdentityImmediately(identity, state);
        }
      });
    }
  })
  .rowActions([
    {
      id: 'delete',
      label: 'Delete',
      icon: <RiDeleteBinLine />,
      disabled: identity => identity.status !== 'active',
      action: 'delete'
    }
  ])
  .bulkActions([
    {
      id: 'delete-selected',
      label: 'Delete',
      icon: <RiDeleteBinLine />,
      disabled: identity => identity.status !== 'active',
      action: 'deleteImmediate',
      bulkExecution: {
        mode: 'per-row',
        batchSize: 10
      }
    }
  ])
  .link(((identity: Identity, props: IdentitiesTableProps) =>
    Paths.instance.identity.identity(
      props.organization.data,
      props.project.data,
      props.instance.data,
      identity.id
    )) as any)
  .build();

export let IdentitiesTable = ({
  instanceId,
  filters
}: {
  instanceId: string;
  filters?: IdentityFilters;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return identitiesTable({
    instanceId,
    filters,
    instance,
    organization,
    project,
    emptyState: 'No identities found.'
  });
};
