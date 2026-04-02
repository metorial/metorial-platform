import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, usePortalConsumerGroup } from '@metorial/state';
import { Button, Checkbox, Input, Spacer, TextArrayInput, confirm } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';

export let PortalGroupSettingsPage = () => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let { portalId, groupId } = useParams();
  let group = usePortalConsumerGroup(instance.data?.id, portalId, groupId);
  let updateMutator = group.useUpdateMutator();
  let deleteMutator = group.useDeleteMutator();

  let form = useForm({
    initialValues: {
      name: group.data?.name || '',
      description: group.data?.description || '',
      isDefault: !!group.data?.isDefault,
      ssoGroupIds: group.data?.ssoGroupIds || []
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await updateMutator.mutate({
        name: values.name,
        description: values.description || undefined,
        isDefault: values.isDefault,
        ssoGroupIds: values.ssoGroupIds.filter(id => id.trim() !== '')
      });
    },
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required'),
        description: yup.string(),
        isDefault: yup.boolean(),
        ssoGroupIds: yup.array(yup.string())
      })
  });

  if (!portalId || !groupId) return null;

  return renderWithLoader({ group })(({ group }) => (
    <>
      <Box title="Group Details" description="Manage the settings for this portal group.">
        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer size={15} />

          <Checkbox
            label="Assign to every user by default"
            checked={form.values.isDefault}
            onCheckedChange={value => form.setFieldValue('isDefault', !!value)}
          />

          <Spacer size={15} />

          <TextArrayInput
            label="SSO Group IDs"
            description="Users with any of these SSO groups will be assigned to this portal group."
            value={form.values.ssoGroupIds}
            onChange={value => form.setFieldValue('ssoGroupIds', value)}
          />

          <Spacer size={15} />

          <Button size="2" type="submit" loading={updateMutator.isLoading} success={updateMutator.isSuccess}>
            Save
          </Button>
        </form>
      </Box>

      <Spacer size={15} />

      <Box
        title="Delete Group"
        description="Deleting this group removes its assignments and access rules."
      >
        <Button
          size="2"
          color="red"
          loading={deleteMutator.isLoading}
          onClick={() =>
            confirm({
              title: 'Delete Portal Group',
              description: 'Are you sure you want to delete this portal group?',
              onConfirm: async () => {
                let [deleted] = await deleteMutator.mutate();
                if (deleted) {
                  navigate(
                    Paths.instance.portal(
                      instance.data?.organization,
                      instance.data?.project,
                      instance.data,
                      portalId,
                      'groups'
                    )
                  );
                }
              }
            })
          }
        >
          Delete Group
        </Button>
      </Box>
    </>
  ));
};
