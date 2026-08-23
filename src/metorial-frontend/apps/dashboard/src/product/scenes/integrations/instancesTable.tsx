import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  IntegrationInstance,
  IntegrationPreview,
  useCreateIntegrationInstance,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDeleteIntegrationInstance,
  useIntegrationInstances
} from '@metorial/state';
import {
  Badge,
  Button,
  Dialog,
  Input,
  RenderDate,
  Spacer,
  Text,
  confirm,
  showModal
} from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiDeleteBinLine } from '@remixicon/react';
import { useState } from 'react';
import { Table as DashboardTable } from '@metorial/table';
import {
  FilterPayload,
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getStringFilterValue
} from '@metorial/table';

export let showIntegrationInstanceFormModal = (p: {
  instanceId: string;
  integration: IntegrationPreview;
  onCreate?: (integrationInstance: IntegrationInstance) => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let createInstance = useCreateIntegrationInstance();
    let form = useForm({
      initialValues: {
        name: '',
        description: ''
      },
      onSubmit: async values => {
        let [created] = await createInstance.mutate({
          instanceId: p.instanceId,
          integrationId: p.integration.id,
          name: values.name.trim(),
          description: values.description.trim() || undefined
        });
        if (!created) return;
        p.onCreate?.(created);
        close();
      },
      schema: yup =>
        yup.object({
          name: yup.string().trim().required('Name is required'),
          description: yup.string()
        })
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={650}>
        <Dialog.Title>Create Instance</Dialog.Title>
        <Dialog.Description>Create an instance of {p.integration.name}.</Dialog.Description>
        <form onSubmit={form.handleSubmit}>
          <Input label="Name" required {...form.getFieldProps('name')} />
          <form.RenderError field="name" />
          <Spacer size={10} />
          <Input label="Description" {...form.getFieldProps('description')} />
          <Spacer size={15} />
          <Dialog.Actions>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={createInstance.isPending}>
              Create Instance
            </Button>
          </Dialog.Actions>
          <createInstance.RenderError />
        </form>
      </Dialog.Wrapper>
    );
  });

type IntegrationInstancesTableProps = {
  instanceId: string;
  integration: IntegrationPreview;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let getInstanceStatusColor = (status: IntegrationInstance['status']) => {
  if (status === 'active') return 'green';
  if (status === 'draft') return 'blue';
  if (status === 'archived') return 'orange';
  return 'gray';
};

let getStatusFilterValue = (value: FilterPayload | undefined) =>
  getEnumListFilterValue(value, ['draft', 'active', 'archived', 'deleted']);

let useIntegrationInstancesTableState = (
  props: IntegrationInstancesTableProps,
  opts: { filter: Record<string, FilterPayload>; search?: string }
) => {
  let instances = useIntegrationInstances(props.instanceId, {
    integrationId: props.integration.id,
    order: 'desc',
    status: getStatusFilterValue(opts.filter.status) ?? ['active'],
    id: getStringFilterValue(opts.filter.id),
    integrationProviderId: getStringFilterValue(opts.filter.integrationProviderId),
    identityId: getStringFilterValue(opts.filter.identityId),
    search: opts.search,
    createdAt: getDateRangeFilterValue(opts.filter.createdAt),
    updatedAt: getDateRangeFilterValue(opts.filter.updatedAt)
  });

  return {
    isLoading: instances.isLoading,
    error: instances.error,
    hasMoreAfter: instances.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: instances.data?.pagination.hasMoreBefore ?? false,
    items: instances.data?.items ?? [],
    loadNext: instances.next,
    loadPrevious: instances.previous
  };
};

let useIntegrationInstancesTableHookState = (
  _: ReturnType<typeof useIntegrationInstancesTableState>,
  props: IntegrationInstancesTableProps
) => {
  let deleteInstance = useDeleteIntegrationInstance();
  let [loadingIds, setLoadingIds] = useState<string[]>([]);

  return {
    deleteInstance,
    instanceId: props.instanceId,
    loadingIds,
    setLoadingIds
  };
};

let deleteIntegrationInstanceImmediately = async (
  integrationInstance: IntegrationInstance,
  state: ReturnType<typeof useIntegrationInstancesTableHookState>
) => {
  state.setLoadingIds(current => [...new Set([...current, integrationInstance.id])]);

  try {
    await state.deleteInstance.mutate({
      instanceId: state.instanceId,
      integrationInstanceId: integrationInstance.id
    });
  } finally {
    state.setLoadingIds(current => current.filter(id => id !== integrationInstance.id));
  }
};

let integrationInstancesTable = new DashboardTable<
  IntegrationInstancesTableProps,
  IntegrationInstance
>('integration-instances')
  .state(useIntegrationInstancesTableState)
  .hookState(useIntegrationInstancesTableHookState)
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: (integrationInstance: IntegrationInstance) => (
        <div>
          <Text size="2" weight="strong">
            {integrationInstance.name}
          </Text>
          {integrationInstance.description && (
            <Text size="1" color="gray600">
              {integrationInstance.description}
            </Text>
          )}
        </div>
      )
    },
    {
      id: 'providers',
      isDefault: true,
      header: 'Providers',
      render: (integrationInstance: IntegrationInstance) => (
        <Text size="2">{integrationInstance.providers?.length ?? 0} providers</Text>
      )
    },
    {
      id: 'status',
      isDefault: true,
      header: 'Status',
      render: (integrationInstance: IntegrationInstance) => (
        <Badge color={getInstanceStatusColor(integrationInstance.status)}>
          {integrationInstance.status}
        </Badge>
      )
    },
    {
      id: 'identity',
      isDefault: false,
      header: 'Identity',
      render: (integrationInstance: IntegrationInstance) =>
        integrationInstance.identityId ? (
          <ID id={integrationInstance.identityId} />
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
      render: (integrationInstance: IntegrationInstance) =>
        integrationInstance.createdAt ? (
          <RenderDate date={integrationInstance.createdAt} />
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
      render: (integrationInstance: IntegrationInstance) =>
        integrationInstance.updatedAt ? (
          <RenderDate date={integrationInstance.updatedAt} />
        ) : (
          <Text size="2" color="gray600">
            -
          </Text>
        )
    },
    {
      id: 'id',
      isDefault: true,
      header: 'ID',
      render: (integrationInstance: IntegrationInstance) => <ID id={integrationInstance.id} />
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
        { id: 'draft', label: 'Draft' },
        { id: 'active', label: 'Active' },
        { id: 'archived', label: 'Archived' },
        { id: 'deleted', label: 'Deleted' }
      ]
    },
    {
      id: 'id',
      fields: ['id'],
      label: 'Instance ID',
      description: 'Filter by instance ID',
      type: 'string'
    },
    {
      id: 'identityId',
      fields: ['identityId'],
      label: 'Identity ID',
      description: 'Filter by identity ID',
      type: 'string'
    },
    {
      id: 'createdAt',
      fields: ['createdAt'],
      label: 'Created',
      description: 'Filter by created date',
      type: 'date'
    },
    {
      id: 'updatedAt',
      fields: ['updatedAt'],
      label: 'Updated',
      description: 'Filter by updated date',
      type: 'date'
    }
  ])
  .search('Search integration instances...')
  .link(((integrationInstance: IntegrationInstance, props: IntegrationInstancesTableProps) =>
    Paths.instance.integrationInstance(
      props.organization.data,
      props.project.data,
      props.instance.data,
      integrationInstance.id
    )) as any)
  .actions({
    deleteImmediate: async (instances, state) => {
      let integrationInstance = instances[0];
      if (!integrationInstance) return;

      await deleteIntegrationInstanceImmediately(integrationInstance, state);
    },
    delete: async (instances, state) => {
      let integrationInstance = instances[0];
      if (!integrationInstance) return;

      confirm({
        title: 'Delete instance',
        description: `Delete ${integrationInstance.name}?`,
        confirmText: 'Delete',
        onConfirm: async () => {
          await deleteIntegrationInstanceImmediately(integrationInstance, state);
        }
      });
    }
  })
  .rowActions([
    {
      id: 'delete',
      label: 'Delete',
      icon: <RiDeleteBinLine />,
      action: 'delete'
    }
  ])
  .bulkActions([
    {
      id: 'delete-selected',
      label: 'Delete',
      icon: <RiDeleteBinLine />,
      action: 'deleteImmediate',
      bulkExecution: {
        mode: 'per-row',
        batchSize: 5
      }
    }
  ])
  .build();

export let IntegrationInstancesTable = (p: {
  instanceId: string;
  integration: IntegrationPreview;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return integrationInstancesTable({
    instanceId: p.instanceId,
    integration: p.integration,
    instance,
    organization,
    project,
    emptyState: 'No instances have been created for this integration yet.'
  });
};
