import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useProviderConfigVault } from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { DeleteResourceDangerZone } from '../../../scenes/deleteResourceDangerZone';
import { getFromDeployment } from '../fromDeployment';

export let ProviderConfigVaultSettingsPage = () => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let location = useLocation();

  let { providerConfigVaultId } = useParams();
  let vault = useProviderConfigVault(instance.data?.id, providerConfigVaultId);

  let updateMutator = vault.useUpdateMutator();
  let deleteMutator = vault.useDeleteMutator();
  let fromDeploymentId = getFromDeployment(location.search, vault.data?.deployment?.id);
  let form = useForm({
    initialValues: {
      name: vault.data?.name ?? '',
      description: vault.data?.description ?? ''
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

  return renderWithLoader({ vault })(({ vault }) => (
    <>
      <Box
        title="Config Vault Settings"
        description="Modify the saved details for this config vault."
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
        description="Delete this config vault and remove it from your saved reusable configurations."
        buttonLabel="Delete Config Vault"
        confirmTitle="Delete config vault"
        confirmDescription="Are you sure you want to delete this config vault?"
        loading={deleteMutator.isLoading}
        success={deleteMutator.isSuccess}
        disabled={vault.data.status !== 'active'}
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
                  'config-vaults'
                )
              : Paths.instance.providerConfigVaults(
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
