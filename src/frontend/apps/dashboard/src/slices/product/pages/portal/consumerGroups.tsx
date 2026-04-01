import { renderWithLoader, renderWithPagination, useForm } from '@metorial/data-hooks';
import { useCreatePortalConsumerGroup, useCurrentInstance, usePortalConsumerGroups } from '@metorial/state';
import {
  Button,
  Checkbox,
  Dialog,
  Entity,
  RenderDate,
  Spacer,
  Text,
  TextArrayInput,
  Input,
  showModal
} from '@metorial/ui';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';

let GroupList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let showCreateConsumerGroupModal = (props: {
  instanceId: string;
  portalId: string;
  onCreate: () => void;
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
        let [created] = await createGroup.mutate({
          instanceId: props.instanceId,
          portalId: props.portalId,
          name: values.name,
          description: values.description || undefined,
          isDefault: values.isDefault,
          ssoGroupIds: values.ssoGroupIds
        });

        if (!created) return;

        props.onCreate();
        close();
      }
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={560}>
        <Dialog.Title>Create Consumer Group</Dialog.Title>
        <Dialog.Description>
          Create a new consumer group for portal access assignments.
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
            value={form.values.ssoGroupIds}
            onChange={value => form.setFieldValue('ssoGroupIds', value)}
            placeholder="group-id"
          />
          <form.RenderError field="ssoGroupIds" />

          <Spacer size={15} />

          <Checkbox
            label="Default group"
            checked={form.values.isDefault}
            onCheckedChange={checked => form.setFieldValue('isDefault', !!checked)}
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

export let PortalConsumerGroupsPage = () => {
  let instance = useCurrentInstance();
  let { portalId } = useParams();
  let groups = usePortalConsumerGroups(instance.data?.id, portalId);

  if (!portalId) return null;

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      <Spacer size={15} />

      <Button
        onClick={() =>
          showCreateConsumerGroupModal({
            instanceId: instance.data.id,
            portalId,
            onCreate: () => groups.refetch()
          })
        }
      >
        Create Group
      </Button>

      <Spacer size={15} />

      {renderWithPagination(groups, {
        hidePaginationWhenUnavailable: true
      })(groups => (
        <GroupList>
          {groups.data.items.map(group => (
            <Entity.Wrapper key={group.id}>
              <Entity.Content>
                <Entity.Field
                  title={group.name}
                  value={group.description ?? 'No description'}
                />
                <Entity.Field
                  title="Default"
                  value={group.isDefault ? 'Yes' : 'No'}
                />
                <Entity.Field
                  title="SSO Group IDs"
                  value={group.ssoGroupIds.length ? group.ssoGroupIds.join(', ') : 'None'}
                />
                <Entity.Field title="Status" value={group.status} />
                <Entity.Field
                  title="Created"
                  value={<RenderDate date={group.createdAt} />}
                />
              </Entity.Content>
            </Entity.Wrapper>
          ))}

          {groups.data.items.length === 0 && (
            <Text size="2" color="gray600">
              No consumer groups configured for this portal.
            </Text>
          )}
        </GroupList>
      ))}
    </>
  ));
};
