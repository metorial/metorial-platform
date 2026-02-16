import { DashboardInstancePortalsConsumerGroupsListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { renderWithPagination, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCreatePortalConsumerGroup,
  useCurrentInstance,
  usePortalConsumerGroups
} from '@metorial/state';
import {
  Button,
  Dialog,
  Flex,
  Input,
  RenderDate,
  showModal,
  Spacer,
  Text
} from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let PortalConsumerGroupsTable = (
  filter: DashboardInstancePortalsConsumerGroupsListQuery & {
    portalId: string | undefined;
  }
) => {
  let instance = useCurrentInstance();
  let groups = usePortalConsumerGroups(instance.data?.instanceId, filter.portalId, filter);

  return renderWithPagination(groups)(groups => (
    <>
      <Table
        headers={['Info', 'Type', 'Created']}
        data={groups.data.items.map(group => ({
          data: [
            <Flex gap={3} direction="column">
              <Text size="2" weight="strong">
                {group.name ?? <span>Untitled</span>}
              </Text>
              <Text size="1" color="gray600" truncate>
                {group.description}
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

      {groups.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No consumer groups found.
        </Text>
      )}
    </>
  ));
};

export let showConsumerGroupFormModal = (d: { portalId: string }) =>
  showModal(({ dialogProps, close }) => {
    let mutator = useCreatePortalConsumerGroup();
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
          instanceId: instance.data!.instanceId,
          portalId: d.portalId
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
        <Dialog.Title>Create Consumer Group</Dialog.Title>
        <Dialog.Description>
          Use consumer groups to manage access to your portal's servers.
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
