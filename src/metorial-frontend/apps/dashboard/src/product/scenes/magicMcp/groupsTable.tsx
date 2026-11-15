import { DashboardInstanceMagicMcpGroupsListQuery } from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  defineAction,
  deleteAction,
  f,
  lifecycleStatus,
  withDefaults
} from '@metorial/data-list';
import { useForm, useMutation } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  magicMcpGroupsLoader,
  useCreateMagicMcpGroup,
  useCurrentInstance,
  useMagicMcpGroup,
  useMagicMcpGroups,
  withAuth
} from '@metorial/state';
import { Button, Dialog, Input, showModal, Spacer } from '@metorial/ui';
import { RiEditLine } from '@remixicon/react';
import type { ComponentProps } from 'react';
import { useInstanceContext } from '../../lib/dataList';

type MagicMcpGroupsListProps = DashboardInstanceMagicMcpGroupsListQuery & {
  getGroupPath?: (groupId: string) => string;
};

let showUpdateGroupModal = (d: {
  instanceId: string;
  group: { id: string; name?: string | null; description?: string | null };
}) =>
  showModal(({ dialogProps, close }) => {
    let group = useMagicMcpGroup(d.instanceId, d.group.id);
    let mutator = group.useUpdateMutator();

    let form = useForm({
      initialValues: {
        name: d.group.name ?? undefined,
        description: d.group.description ?? undefined
      },
      onSubmit: async values => {
        let [res] = await mutator.mutate(values);

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

let useDeleteMagicMcpGroup = () =>
  useMutation(
    (i: { instanceId: string; magicMcpGroupId: string }) =>
      withAuth(sdk => sdk.magicMcp.groups.delete(i.instanceId, i.magicMcpGroupId)),
    { onSuccess: () => void magicMcpGroupsLoader.refetchAll() }
  );

let MagicGroupsList = createDataList<MagicMcpGroupsListProps>('magic-mcp-groups')
  .context(useInstanceContext)
  .filters(() => ({
    status: f.status(lifecycleStatus)
  }))
  .search('Search Magic MCP groups…')
  .paginated(({ props, ctx, filters, search, limit }) =>
    useMagicMcpGroups(
      ctx.instanceId,
      withDefaults(
        {
          order: props.order ?? 'asc',
          status: props.status,
          search: props.search,
          limit: props.limit
        },
        { ...filters, search, limit }
      )
    )
  )
  .columns([
    col.name({ fallback: 'Unnamed Group' }),
    col.refId('slug', row => row.slug, { header: 'Slug', isDefault: true }),
    col.createdAt(),
    col.status(lifecycleStatus, { isDefault: false }),
    col.updatedAt(),
    col.id({ header: 'Group ID' })
  ])
  .link((row, props, ctx) =>
    props.getGroupPath
      ? props.getGroupPath(row.id)
      : Paths.organization.instance.magicMcp.group(
          ctx.organization,
          ctx.project,
          ctx.instance,
          row.id
        )
  )
  .itemActions([
    defineAction({
      id: 'update',
      label: 'Update',
      icon: <RiEditLine />,
      disabled: row => row.status !== 'active',
      useRun:
        ({ ctx }) =>
        row => {
          showUpdateGroupModal({ instanceId: ctx.instanceId!, group: row });
        }
    }),
    deleteAction({
      noun: 'Group',
      name: row => row.name,
      disabled: row => row.status !== 'active',
      useMutate: () => useDeleteMagicMcpGroup(),
      input: (row, { ctx }) => ({ instanceId: ctx.instanceId!, magicMcpGroupId: row.id })
    })
  ])
  .build();

export let MagicGroupsTable = (props: ComponentProps<typeof MagicGroupsList>) => (
  <MagicGroupsList emptyState="No Magic MCP groups found." {...props} />
);

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
