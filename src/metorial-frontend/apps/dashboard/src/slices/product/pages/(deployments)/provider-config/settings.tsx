import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useProviderConfig } from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';
import { DeleteResourceDangerZone } from '../../../scenes/deleteResourceDangerZone';

export let ProviderConfigSettingsPage = () => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();

  let { providerConfigId } = useParams();
  let config = useProviderConfig(instance.data?.id, providerConfigId);
  let updateMutator = config.useUpdateMutator();
  let deleteMutator = config.useDeleteMutator();
  let form = useForm({
    initialValues: {
      name: config.data?.name ?? '',
      description: config.data?.description ?? ''
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
      }) as any
  });

  return renderWithLoader({ config })(({ config }) => (
    <>
      <Box title="Config Settings" description="Modify the settings of this configuration.">
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
        description="Delete this config and remove it from your saved provider configurations."
        buttonLabel="Delete Config"
        confirmTitle="Delete config"
        confirmDescription="Are you sure you want to delete this config?"
        loading={deleteMutator.isLoading}
        success={deleteMutator.isSuccess}
        onDelete={async () => {
          let [res] = await deleteMutator.mutate({});
          if (!res) return;

          navigate(
            config.data.deployment?.id
              ? Paths.instance.providerDeployment(
                  instance.data?.organization,
                  instance.data?.project,
                  instance.data,
                  config.data.deployment.id,
                  'configs'
                )
              : Paths.instance.providerConfigs(
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
