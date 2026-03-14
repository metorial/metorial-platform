import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderDeployment } from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { ProviderDeploymentTabSection } from '../../../scenes/providerDeployments/tabSection';

export let ProviderDeploymentSettingsPage = () => {
  let instance = useCurrentInstance();

  let { providerDeploymentId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let updateMutator = deployment.useUpdateMutator();
  let form = useForm({
    initialValues: {
      name: deployment.data?.name ?? '',
      description: deployment.data?.description ?? ''
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
        description: yup.string().ensure()
      })
  });

  return renderWithLoader({ deployment })(() => (
    <ProviderDeploymentTabSection>
      <Box title="Deployment Settings" description="Modify the settings of this deployment.">
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
    </ProviderDeploymentTabSection>
  ));
};
