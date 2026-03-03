import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderAuthCredential } from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

export let ProviderAuthCredentialSettingsPage = () => {
  let instance = useCurrentInstance();

  let { providerDeploymentId, providerAuthCredentialsId } = useParams();
  let credential = useProviderAuthCredential(instance.data?.id, providerAuthCredentialsId);
  let updateMutator = credential.useUpdateMutator();
  let form = useForm({
    initialValues: {
      name: credential.data?.name ?? '',
      description: credential.data?.description ?? ''
    },
    updateInitialValues: true,
    onSubmit: async () => {},
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required'),
        description: yup.string().defined()
      })
  });

  let handleSubmit = async () => {
    let name = form.values.name.trim();

    if (!name) {
      form.setFieldTouched('name', true);
      form.setFieldError('name', 'Name is required');
      return;
    }

    form.setFieldError('name', undefined);

    await updateMutator.mutate({
      name,
      description: form.values.description || undefined
    });
  };

  return renderWithLoader({ credential })(({ credential }) => (
    <>
      <Box
        title="Auth Credential Settings"
        description="Modify the settings of this auth credential."
      >
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={15} />

          <Input label="Description" {...form.getFieldProps('description')} />

          <Spacer size={15} />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="2" type="button" onClick={handleSubmit} loading={updateMutator.isPending}>
              Save
            </Button>
          </div>

          <updateMutator.RenderError />
        </form>
      </Box>
    </>
  ));
};
