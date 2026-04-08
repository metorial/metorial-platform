import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useProviderAuthConfig } from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { DeleteResourceDangerZone } from '../../../scenes/deleteResourceDangerZone';
import { getFromDeployment } from '../fromDeployment';

export let ProviderAuthConfigSettingsPage = () => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let location = useLocation();

  let { providerAuthConfigId } = useParams();
  let authConfig = useProviderAuthConfig(instance.data?.id, providerAuthConfigId);
  let updateMutator = authConfig.useUpdateMutator();
  let deleteMutator = authConfig.useDeleteMutator();
  let fromDeploymentId = getFromDeployment(location.search);
  let form = useForm({
    initialValues: {
      name: authConfig.data?.name ?? '',
      description: authConfig.data?.description ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await updateMutator.mutate({
        name: values.name.trim(),
        description: values.description || undefined
      });
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string()
      })
  });

  return renderWithLoader({ authConfig })(({ authConfig }) => (
    <>
      <Box title="Auth Config Settings" description="Modify the settings of this auth config.">
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
        description="Delete this auth config and remove it from your saved provider authentication setup."
        buttonLabel="Delete Auth Config"
        confirmTitle="Delete auth config"
        confirmDescription="Are you sure you want to delete this auth config?"
        loading={deleteMutator.isLoading}
        success={deleteMutator.isSuccess}
        onDelete={async () => {
          let [res] = await deleteMutator.mutate({});
          if (!res) return;

          navigate(
            fromDeploymentId
              ? Paths.instance.providerDeployment(
                  instance.data?.organization,
                  instance.data?.project,
                  instance.data,
                  fromDeploymentId,
                  'auth-configs'
                )
              : Paths.instance.providerAuthConfigs(
                  instance.data?.organization,
                  instance.data?.project,
                  instance.data
                )
          );
        }}
      />
    </>
  ));
};
