import {
  DashboardInstancePortalsConsumerGroupsCreateBody,
  DashboardInstancePortalsConsumerGroupsListQuery
} from '@metorial/dashboard-sdk';
import { renderWithPagination, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCreatePortalConsumerGroup,
  useCurrentInstance,
  usePortalConsumerGroups
} from '@metorial/state';
import {
  Button,
  Checkbox,
  Dialog,
  Flex,
  Input,
  RenderDate,
  Spacer,
  Text,
  TextArrayInput,
  showModal
} from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let PortalConsumerGroupsTable = (
  filter: DashboardInstancePortalsConsumerGroupsListQuery & {
    portalId: string | undefined;
  }
) => {
  let instance = useCurrentInstance();
  let groups = usePortalConsumerGroups(instance.data?.id, filter.portalId, filter);

  return renderWithPagination(groups, {
    hidePaginationWhenUnavailable: true
  })(groups => (
    <>
      <Table
        headers={['Info', 'Type', 'Created']}
        data={groups.data.items.map(group => ({
          data: [
            <Flex gap={3} direction="column">
              <Text size="2" weight="strong">
                {group.name || 'Untitled Group'}
              </Text>
              <Text size="1" color="gray600" truncate>
                {group.description || 'No description'}
              </Text>
            </Flex>,
            <Text>
              {group.isDefault ? 'Default' : group.ssoGroupIds.length ? 'SSO' : 'Manual'}
            </Text>,
            <RenderDate date={group.createdAt} />
          ],
          href: Paths.instance.portal(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            filter.portalId,
            'group',
            group.id
          )
        }))}
      />

      {groups.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No consumer groups found.
        </Text>
      )}
    </>
  ));
};

export let showConsumerGroupFormModal = (props: {
  instanceId: string;
  portalId: string;
  onCreate?: () => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let createGroup = useCreatePortalConsumerGroup();
    let form = useForm({
      initialValues: {
        name: '',
        description: '',
        isDefault: false,
        ssoGroupIds: [] as string[]
      },
      schema: yup =>
        yup.object({
          name: yup.string().required('Name is required'),
          description: yup.string(),
          isDefault: yup.boolean(),
          ssoGroupIds: yup.array(yup.string())
        }),
      onSubmit: async values => {
        let body: DashboardInstancePortalsConsumerGroupsCreateBody = {
          name: values.name,
          description: values.description || undefined,
          isDefault: values.isDefault,
          ssoGroupIds: values.ssoGroupIds
        };

        let [created] = await createGroup.mutate({
          instanceId: props.instanceId,
          portalId: props.portalId,
          ...body
        });

        if (!created) return;

        props.onCreate?.();
        close();
      }
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={560}>
        <Dialog.Title>Create Consumer Group</Dialog.Title>
        <Dialog.Description>
          Use consumer groups to define who can access provider templates and Magic MCP
          servers in this portal.
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer size={15} />

          <TextArrayInput
            label="SSO Group IDs"
            description="Users with these SSO groups will be matched into this consumer group."
            value={form.values.ssoGroupIds}
            onChange={value => form.setFieldValue('ssoGroupIds', value)}
          />
          <form.RenderError field="ssoGroupIds" />

          <Spacer size={15} />

          <Checkbox
            label="Assign to every user by default"
            checked={form.values.isDefault}
            onCheckedChange={value => form.setFieldValue('isDefault', !!value)}
          />

          <Spacer size={20} />

          <Dialog.Actions>
            <Button type="button" variant="soft" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={createGroup.isLoading}>
              Create Group
            </Button>
          </Dialog.Actions>
        </form>
      </Dialog.Wrapper>
    );
  });
