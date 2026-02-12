import { DashboardInstanceMagicMcpGroupsListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { renderWithPagination, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCreateMagicMcpGroup,
  useCurrentInstance,
  useMagicMcpGroups
} from '@metorial/state';
import {
  Button,
  confirm,
  Dialog,
  Input,
  Menu,
  RenderDate,
  showModal,
  Spacer,
  Text,
  toast
} from '@metorial/ui';
import { ID, Table } from '@metorial/ui-product';
import { RiMoreLine } from '@remixicon/react';

export let MagicGroupsTable = (filter: DashboardInstanceMagicMcpGroupsListQuery) => {
  let instance = useCurrentInstance();
  let groups = useMagicMcpGroups(instance.data?.instanceId, {
    ...filter,
    order: filter.order ?? 'asc'
  });

  let deleteGroupMutation = groups.revokeMutator();
  let deleteGroupModal = ({ groupId }: { groupId: string }) =>
    confirm({
      title: `Delete Magic MCP group`,
      description: `Are you sure you want to delete this Magic MCP group?`,
      confirmText: `Delete`,
      onConfirm: async () => {
        let [res] = await deleteGroupMutation.mutate({
          magicMcpGroupId: groupId
        });
        if (res) toast.success(`Magic MCP group deleted`);
      }
    });

  let updateGroupModal = ({ groupId }: { groupId: string }) =>
    showModal(({ dialogProps, close }) => {
      let group = groups.data?.items?.find(k => k.id === groupId);
      let mutator = groups.updateMutator();

      let form = useForm({
        initialValues: {
          name: group?.name ?? undefined,
          description: group?.description ?? undefined
        },
        onSubmit: async values => {
          let [res] = await mutator.mutate({
            ...values,
            magicMcpGroupId: groupId
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

  return renderWithPagination(groups)(groups => (
    <>
      <Table
        headers={['Name', 'Slug', 'Created', '']}
        data={groups.data.items.map(group => ({
          href: Paths.instance.magicMcp.group(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            group.id
          ),
          data: [
            <div>
              <Text size="2" weight="strong">
                {group.name}
              </Text>
              {group.description && (
                <Text size="1" color="gray600">
                  {group.description}
                </Text>
              )}
            </div>,

            <ID id={group.slug} />,

            <RenderDate date={group.createdAt} />,

            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10
              }}
              onClick={e => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <Button size="1" variant="outline">
                Edit Group
              </Button>

              <Menu
                items={[
                  {
                    id: 'update',
                    label: 'Update',
                    disabled: group.status != 'active'
                  },
                  {
                    id: 'delete',
                    label: 'Delete',
                    disabled: group.status != 'active'
                  }
                ]}
                onItemClick={item => {
                  if (item == 'update')
                    updateGroupModal({
                      groupId: group.id
                    });
                  if (item == 'delete')
                    deleteGroupModal({
                      groupId: group.id
                    });
                }}
              >
                <Button
                  size="1"
                  variant="outline"
                  iconLeft={<RiMoreLine />}
                  title="Open group options"
                />
              </Menu>
            </div>
          ]
        }))}
      />

      {groups.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No Magic MCP groups found.
        </Text>
      )}
    </>
  ));
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

        if (res) {
          close();
        }
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
