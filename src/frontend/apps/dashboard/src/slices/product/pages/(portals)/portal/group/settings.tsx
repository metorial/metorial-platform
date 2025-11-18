import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, usePortal, usePortalConsumerGroup } from '@metorial/state';
import { Button, Checkbox, confirm, Input, Spacer, TextArrayInput } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';

export let PortalGroupSettingsPage = () => {
  let instance = useCurrentInstance();
  let params = useParams();
  let portal = usePortal(instance.data?.id, params.portalId!);
  let group = usePortalConsumerGroup(instance.data?.id, portal.data?.id, params.groupId);

  let updateMutator = group.useUpdateMutator();
  let deleteMutator = group.useDeleteMutator();

  let navigate = useNavigate();

  let form = useForm({
    initialValues: {
      name: group.data?.name || '',
      description: group.data?.description || '',
      isDefault: !!group.data?.isDefault,
      ssoGroupIds: group.data?.ssoGroupIds || []
    },
    updateInitialValues: true,
    onSubmit: async values => {
      let [res] = await updateMutator.mutate({
        name: values.name,
        description: values.description,
        isDefault: values.isDefault,
        ssoGroupIds: values.ssoGroupIds.filter(s => s.trim() !== '')
      });
    },
    schema: yup =>
      yup.object().shape({
        name: yup.string().required('Name is required'),
        description: yup.string(),
        isDefault: yup.boolean(),
        ssoGroupIds: yup.array().of(yup.string())
      }) as any
  });

  return renderWithLoader({ group })(({ group }) => (
    <>
      <Box title="Group Details" description="Manage the settings for this portal group.">
        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer height={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer height={15} />

          <Checkbox
            label="Assign to every user by default"
            checked={form.values.isDefault}
            onCheckedChange={v => form.setFieldValue('isDefault', v)}
          />
          <form.RenderError field="isDefault" />

          <Spacer height={15} />

          <TextArrayInput
            label="SSO Group IDs"
            description="Users with any of these groups from an SSO provider will be assigned to this portal group."
            value={form.values.ssoGroupIds}
            onChange={v => form.setFieldValue('ssoGroupIds', v)}
          />
          <form.RenderError field="ssoGroupIds" />

          <Spacer height={25} />

          <Button
            type="submit"
            size="2"
            loading={updateMutator.isLoading}
            success={updateMutator.isSuccess}
          >
            Save
          </Button>
        </form>
      </Box>

      <Spacer height={25} />

      <Box
        title="Delete Group"
        description="Deleting this group will remove it from all users and cannot be undone."
      >
        <Button
          size="2"
          color="red"
          onClick={() =>
            confirm({
              title: 'Delete Portal Group',
              description:
                'Are you sure you want to delete this portal group? This action cannot be undone.',
              onConfirm: async () => {
                let [res] = await deleteMutator.mutate({});

                if (res) {
                  navigate(
                    Paths.instance.portal(
                      instance.data?.organization,
                      instance.data?.project,
                      instance.data,
                      portal.data?.id,
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
