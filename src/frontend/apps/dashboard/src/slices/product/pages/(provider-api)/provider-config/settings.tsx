import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderConfig } from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

export let ProviderConfigSettingsPage = () => {
  let instance = useCurrentInstance();

  let { providerDeploymentId, providerConfigId } = useParams();
  let config = useProviderConfig(instance.data?.id, providerDeploymentId, providerConfigId);
  let updateMutator = config.useUpdateMutator();
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
        description: yup.string().defined()
      })
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
    </>
  ));
};
