import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCallbackById,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';
import { DeleteResourceDangerZone } from '../../../scenes/deleteResourceDangerZone';

export let CallbackSettingsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { callbackId } = useParams();
  let callback = useCallbackById(instance.data?.id, callbackId);
  let updateMutator = callback.useUpdateMutator();
  let deleteMutator = callback.useDeleteMutator();
  let navigate = useNavigate();

  let form = useForm({
    initialValues: {
      name: callback.data?.name ?? '',
      description: callback.data?.description ?? ''
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

  return renderWithLoader({ callback })(({ callback }) => (
    <>
      <Box
        title="Callback Details"
        description="How this callback is labelled in the dashboard. Everything else about it is derived from the integration provider."
      >
        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
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
        description="Turning callbacks off stops event delivery for this integration provider and removes every registration Metorial made with the provider."
        buttonLabel="Disable Callbacks"
        confirmTitle={`Disable callbacks for ${callback.data.name}?`}
        confirmDescription="Metorial removes the registrations from the provider and stops recording events. Events already recorded are kept."
        confirmText="Disable"
        loading={deleteMutator.isLoading}
        success={deleteMutator.isSuccess}
        onDelete={async () => {
          let [res] = await deleteMutator.mutate(undefined as never);
          if (!res) return;

          navigate(Paths.instance.callbacks(organization.data, project.data, instance.data));
        }}
      />
    </>
  ));
};
