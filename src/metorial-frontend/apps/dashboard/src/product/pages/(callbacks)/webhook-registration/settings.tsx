import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { DetailsSettingsLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useWebhookRegistration
} from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';
import { DeleteResourceDangerZone } from '../../../scenes/deleteResourceDangerZone';

export let WebhookRegistrationSettingsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { webhookRegistrationId } = useParams();
  let registration = useWebhookRegistration(instance.data?.id, webhookRegistrationId);
  let navigate = useNavigate();
  let updateMutator = registration.useUpdateMutator();
  let deleteMutator = registration.useDeleteMutator();

  let form = useForm({
    initialValues: {
      name: registration.data?.name ?? '',
      description: registration.data?.description ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await updateMutator.mutate({
        name: values.name.trim(),
        description: values.description.trim() || null
      });
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string()
      })
  });

  return renderWithLoader({ registration })(({ registration }) => (
    <DetailsSettingsLayout>
      <Box
        title="Receiver Settings"
        description="Modify the saved details for this webhook receiver."
      >
        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={15} />

          <Input
            label="Description"
            {...form.getFieldProps('description')}
            as="textarea"
            minRows={5}
          />
          <form.RenderError field="description" />

          <Spacer size={15} />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              size="2"
              type="submit"
              loading={updateMutator.isLoading}
              success={updateMutator.isSuccess}
            >
              Save
            </Button>
          </div>

          <updateMutator.RenderError />
        </form>
      </Box>

      <Spacer size={20} />

      <DeleteResourceDangerZone
        description="Metorial tears down the receiver on the provider and stops accepting webhooks at this URL. This cannot be undone."
        buttonLabel="Delete Receiver"
        confirmTitle={`Delete ${registration.data.name}?`}
        confirmDescription={`Are you sure you want to delete ${registration.data.name}?`}
        loading={deleteMutator.isLoading}
        success={deleteMutator.isSuccess}
        onDelete={async () => {
          let [res] = await deleteMutator.mutate(undefined as never);
          if (!res) return;

          navigate(Paths.instance.callbacks(organization.data, project.data, instance.data));
        }}
      />
    </DetailsSettingsLayout>
  ));
};
