import {
  DashboardInstanceIdentityActorsListOutput,
  DashboardInstanceIdentityActorsListQuery
} from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDeleteIdentityActor,
  useIdentityActors
} from '@metorial/state';
import { Badge, RenderDate, Text, confirm } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiDeleteBinLine } from '@remixicon/react';
import { useState } from 'react';
import { Table as DashboardTable } from '../../../../components/table';
import { FilterPayload } from '../../../../components/table/filter';

type IdentityActor = DashboardInstanceIdentityActorsListOutput['items'][number];

type IdentityActorFilters = Omit<
  DashboardInstanceIdentityActorsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

type IdentityActorsTableProps = {
  instanceId: string;
  filters?: IdentityActorFilters;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let getActorTypeLabel = (type: IdentityActor['type']) => {
  if (type === 'agent') return 'Agent';
  return 'Person';
};

let getActorStatusColor = (status: IdentityActor['status']) => {
  if (status === 'active') return 'green';
  if (status === 'archived') return 'orange';
  return 'gray';
};

let getStringFilterValue = (value: FilterPayload | undefined) => {
  if (typeof value === 'string') return value;
  return undefined;
};

let getListFilterValue = (value: FilterPayload | undefined) => {
  if (typeof value === 'object' && value && 'in' in value && Array.isArray(value.in)) {
    return value.in.map(v => v.toString());
  }

  return undefined;
};

let getStatusFilterValue = (
  value: FilterPayload | undefined
): DashboardInstanceIdentityActorsListQuery['status'] => {
  let values = getListFilterValue(value);
  if (!values) return undefined;

  return values.filter(
    (value): value is IdentityActor['status'] =>
      value === 'active' || value === 'archived' || value === 'deleted'
  );
};

let useIdentityActorsTableState = (
  props: IdentityActorsTableProps,
  opts: {
    filter: Record<string, FilterPayload>;
    search?: string;
  }
) => {
  let actors = useIdentityActors(props.instanceId, {
    order: 'desc',
    ...props.filters,
    status: getStatusFilterValue(opts.filter.status) ?? props.filters?.status,
    id: getStringFilterValue(opts.filter.id) ?? props.filters?.id,
    agentId: getStringFilterValue(opts.filter.agentId) ?? props.filters?.agentId,
    search: opts.search ?? props.filters?.search
  });

  return {
    isLoading: actors.isLoading,
    error: actors.error,
    hasMoreAfter: actors.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: actors.data?.pagination.hasMoreBefore ?? false,
    items: actors.data?.items ?? [],
    loadNext: actors.next,
    loadPrevious: actors.previous
  };
};

let useIdentityActorsTableHookState = (
  _: ReturnType<typeof useIdentityActorsTableState>,
  props: IdentityActorsTableProps
) => {
  let deleteActor = useDeleteIdentityActor();
  let [loadingIds, setLoadingIds] = useState<string[]>([]);

  return {
    deleteActor,
    instanceId: props.instanceId,
    loadingIds,
    setLoadingIds
  };
};

let deleteActorImmediately = async (
  actor: IdentityActor,
  state: ReturnType<typeof useIdentityActorsTableHookState>
) => {
  state.setLoadingIds((current: string[]) => [...new Set([...current, actor.id])]);

  try {
    await state.deleteActor.mutate({
      instanceId: state.instanceId,
      identityActorId: actor.id
    });
  } finally {
    state.setLoadingIds((current: string[]) => current.filter(id => id != actor.id));
  }
};

let identityActorsTable = new DashboardTable('identity-actors')
  .state(useIdentityActorsTableState)
  .hookState(useIdentityActorsTableHookState)
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: actor => (
        <div>
          <Text size="2" weight="strong">
            {actor.name}
          </Text>
          {actor.description && (
            <Text size="1" color="gray600">
              {actor.description}
            </Text>
          )}
        </div>
      )
    },
    {
      id: 'type',
      isDefault: true,
      header: 'Type',
      render: actor => <Text size="2">{getActorTypeLabel(actor.type)}</Text>
    },
    {
      id: 'status',
      isDefault: false,
      header: 'Status',
      render: actor => <Badge color={getActorStatusColor(actor.status)}>{actor.status}</Badge>
    },
    {
      id: 'agentId',
      isDefault: false,
      header: 'Agent ID',
      render: actor =>
        actor.agentId ? (
          <ID id={actor.agentId} />
        ) : (
          <Text size="2" color="gray600">
            -
          </Text>
        )
    },
    {
      id: 'description',
      isDefault: false,
      header: 'Description',
      render: actor =>
        actor.description ? (
          <Text size="2">{actor.description}</Text>
        ) : (
          <Text size="2" color="gray600">
            No description
          </Text>
        )
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: actor => <RenderDate date={actor.createdAt} />
    },
    {
      id: 'updatedAt',
      isDefault: false,
      header: 'Updated',
      render: actor => <RenderDate date={actor.updatedAt} />
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Actor ID',
      render: actor => <ID id={actor.id} />
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
      id: 'id',
      fields: ['id'],
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
  .search('Search identity actors...')
  .link((actor, props) =>
    Paths.instance.identity.actor(
      props.organization.data,
      props.project.data,
      props.instance.data,
      actor.id
    )
  )
  .actions({
    deleteImmediate: async (actors, state) => {
      let actor = actors[0];
      if (!actor) return;

      await deleteActorImmediately(actor, state);
    },
    delete: async (actors, state) => {
      let actor = actors[0];
      if (!actor) return;

      confirm({
        title: 'Delete actor',
        description: `Are you sure you want to delete ${actor.name}?`,
        confirmText: 'Delete',
        onConfirm: async () => {
          await deleteActorImmediately(actor, state);
        }
      });
    }
  })
  .rowActions([
    {
      id: 'delete',
      label: 'Delete',
      icon: <RiDeleteBinLine />,
      disabled: actor => actor.status !== 'active',
      action: 'delete'
    }
  ])
  .bulkActions([
    {
      id: 'delete-selected',
      label: 'Delete',
      icon: <RiDeleteBinLine />,
      disabled: actor => actor.status !== 'active',
      action: 'deleteImmediate',
      bulkExecution: {
        mode: 'per-row',
        batchSize: 10
      }
    }
  ])
  .build();

export let IdentityActorsTable = ({
  instanceId,
  filters
}: {
  instanceId: string;
  filters?: IdentityActorFilters;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return identityActorsTable({
    instanceId,
    filters,
    instance,
    organization,
    project,
    emptyState: 'No identity actors found.'
  });
};
