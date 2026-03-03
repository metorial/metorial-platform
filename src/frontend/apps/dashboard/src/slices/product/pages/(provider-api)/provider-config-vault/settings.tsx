import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderConfigVault } from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

export let ProviderConfigVaultSettingsPage = () => {
  let instance = useCurrentInstance();

  let { providerConfigVaultId } = useParams();
  let vault = useProviderConfigVault(instance.data?.id, providerConfigVaultId);
  let updateMutator = vault.useUpdateMutator();
  let form = useForm({
    initialValues: {
      name: vault.data?.name ?? '',
      description: vault.data?.description ?? ''
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

  return renderWithLoader({ vault })(({ vault }) => (
    <Box
      title="Config Vault Settings"
      description="Modify the saved details for this config vault."
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
  ));
};
