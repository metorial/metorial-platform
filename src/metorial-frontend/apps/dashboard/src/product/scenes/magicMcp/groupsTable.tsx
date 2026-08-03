import {
  DashboardInstanceMagicMcpGroupsListOutput,
  DashboardInstanceMagicMcpGroupsListQuery
} from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCreateMagicMcpGroup,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useMagicMcpGroups
} from '@metorial/state';
import {
  Badge,
  Button,
  confirm,
  Dialog,
  Input,
  RenderDate,
  showModal,
  Spacer,
  Text,
  toast
} from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiDeleteBinLine, RiMoreLine } from '@remixicon/react';
import { Table as DashboardTable } from '@metorial/table';
import {
  FilterPayload,
  TableStateProvider,
  TableStateProviderResult,
  getEnumListFilterValue
} from '@metorial/table';

type MagicMcpGroup = DashboardInstanceMagicMcpGroupsListOutput['items'][number];

type MagicMcpGroupsTableProps = DashboardInstanceMagicMcpGroupsListQuery & {
  instanceId: string;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let getGroupStatusFilterValue = (
  value: FilterPayload | undefined
): DashboardInstanceMagicMcpGroupsListQuery['status'] =>
  getEnumListFilterValue(value, ['active', 'archived', 'deleted']);

let showUpdateGroupModal = (d: { groupId: string; instanceId: string }) =>
  showModal(({ dialogProps, close }) => {
    let groups = useMagicMcpGroups(d.instanceId);
    let group = groups.data?.items?.find(item => item.id === d.groupId);
    let mutator = groups.updateMutator();

    let form = useForm({
      initialValues: {
        name: group?.name ?? undefined,
        description: group?.description ?? undefined
      },
      onSubmit: async values => {
        let [res] = await mutator.mutate({
          ...values,
          magicMcpGroupId: d.groupId
        });

        if (res) close();
      },
      schema: yup =>
        yup.object().shape({
          name: yup.string().required('Name is required'),
          description: yup.string()
        }) as any
    });

    return (
      <Dialog.Wrapper {...dialogProps}>
        <Dialog.Title>Update Magic MCP Group</Dialog.Title>
        <Dialog.Description>Update the Magic MCP group details.</Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer height={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer height={15} />

          <Dialog.Actions>
            <Button size="1" variant="soft" onClick={close} type="button">
              Cancel
            </Button>
            <Button size="1" type="submit">
              Update
            </Button>
          </Dialog.Actions>
        </form>
      </Dialog.Wrapper>
    );
  });

let magicGroupsTableState: TableStateProvider<
  MagicMcpGroupsTableProps,
  MagicMcpGroup,
  TableStateProviderResult<MagicMcpGroup>
> = (props, opts) => {
  let groups = useMagicMcpGroups(props.instanceId, {
    order: props.order ?? 'asc',
    status: getGroupStatusFilterValue(opts.filter.status) ?? props.status,
    search: opts.search ?? props.search
  });

  return {
    isLoading: groups.isLoading,
    error: groups.error,
    hasMoreAfter: groups.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: groups.data?.pagination.hasMoreBefore ?? false,
    items: groups.data?.items ?? [],
    loadNext: groups.next,
    loadPrevious: groups.previous
  };
};

let magicGroupsTable = new DashboardTable<
  MagicMcpGroupsTableProps,
  MagicMcpGroup,
  {
    instanceId: string;
    openUpdateModal: (groupId: string) => void;
    deleteGroup: (groupId: string) => Promise<void>;
  }
>('magic-mcp-groups')
  .state(magicGroupsTableState)
  .hookState((_, input) => {
    let groups = useMagicMcpGroups(input.instanceId);
    let deleteMutation = groups.revokeMutator();

    return {
      instanceId: input.instanceId,
      openUpdateModal: (groupId: string) => {
        showUpdateGroupModal({ groupId, instanceId: input.instanceId });
      },
      deleteGroup: async (groupId: string) => {
        let [res] = await deleteMutation.mutate({
          magicMcpGroupId: groupId
        });

        if (res) toast.success('Magic MCP group deleted');
      }
    };
  })
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: group => (
        <div>
          <Text size="2" weight="strong">
            {group.name ?? 'Unnamed Group'}
          </Text>
          {group.description && (
            <Text size="1" color="gray600">
              {group.description}
            </Text>
          )}
        </div>
      )
    },
    {
      id: 'slug',
      isDefault: true,
      header: 'Slug',
      render: group => <ID id={group.slug} />
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: group => <RenderDate date={group.createdAt} />
    },
    {
      id: 'status',
      isDefault: false,
      header: 'Status',
      render: group => (
        <Badge
          color={{ active: 'green', archived: 'orange', deleted: 'gray' }[group.status] as any}
        >
          {group.status}
        </Badge>
      )
    },
    {
      id: 'updatedAt',
      isDefault: false,
      header: 'Updated',
      render: group => <RenderDate date={group.updatedAt} />
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Group ID',
      render: group => <ID id={group.id} />
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
    }
  ])
  .search('Search Magic MCP groups...')
  .link((group, props) =>
    Paths.instance.magicMcp.group(
      props.organization.data,
      props.project.data,
      props.instance.data,
      group.id
    )
  )
  .actions({
    update: async (groups, state) => {
      let group = groups[0];
      if (!group) return;

      state.openUpdateModal(group.id);
    },
    delete: async (groups, state) => {
      let group = groups[0];
      if (!group) return;

      confirm({
        title: 'Delete Magic MCP group',
        description: 'Are you sure you want to delete this Magic MCP group?',
        confirmText: 'Delete',
        onConfirm: async () => {
          await state.deleteGroup(group.id);
        }
      });
    }
  })
  .rowActions([
    {
      id: 'update',
      label: 'Update',
      icon: <RiMoreLine />,
      disabled: group => group.status !== 'active',
      action: 'update'
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: <RiDeleteBinLine />,
      disabled: group => group.status !== 'active',
      action: 'delete'
    }
  ])
  .build();

export let MagicGroupsTable = (filter: DashboardInstanceMagicMcpGroupsListQuery = {}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return magicGroupsTable({
    instanceId: instance.data!.id,
    organization,
    project,
    instance,
    ...filter,
    emptyState: 'No Magic MCP groups found.'
  });
};

export let createMagicMcpGroupModal = () =>
  showModal(({ dialogProps, close }) => {
    let mutator = useCreateMagicMcpGroup();
    let instance = useCurrentInstance();

    let form = useForm({
      initialValues: {
        name: '',
        description: ''
      },
      onSubmit: async values => {
        let [res] = await mutator.mutate({
          name: values.name,
          description: values.description,
          instanceId: instance.data!.id
        });

        if (res) close();
      },
      schema: yup =>
        yup.object().shape({
          name: yup.string().required('Name is required'),
          description: yup.string()
        }) as any
    });

    return (
      <Dialog.Wrapper {...dialogProps}>
        <Dialog.Title>Create Magic MCP Group</Dialog.Title>
        <Dialog.Description>
          Use Magic MCP groups to group together related servers.
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer height={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer height={15} />

          <Dialog.Actions>
            <Button size="1" variant="soft" onClick={close} type="button">
              Cancel
            </Button>
            <Button size="1" type="submit">
              Create
            </Button>
          </Dialog.Actions>
        </form>
      </Dialog.Wrapper>
    );
  });
