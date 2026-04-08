import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useProviderAuthCredential } from '@metorial/state';
import { Button, Callout, Input, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { DeleteResourceDangerZone } from '../../../scenes/deleteResourceDangerZone';
import { getFromDeployment } from '../fromDeployment';

export let ProviderAuthCredentialSettingsPage = () => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let location = useLocation();

  let { providerAuthCredentialsId } = useParams();
  let credential = useProviderAuthCredential(instance.data?.id, providerAuthCredentialsId);
  let updateMutator = credential.useUpdateMutator();
  let deleteMutator = credential.useDeleteMutator();
  let fromDeploymentId = getFromDeployment(location.search);
  let form = useForm({
    initialValues: {
      name: credential.data?.name ?? '',
      description: credential.data?.description ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      if (credential.data?.isManaged) return;

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

  return renderWithLoader({ credential })(({ credential }) => (
    <>
      <Box
        title="Auth Credential Settings"
        description="Modify the settings of this auth credential."
      >
        {credential.data.isManaged && (
          <>
            <Callout color="blue">Managed by Metorial.</Callout>
            <Spacer size={15} />
          </>
        )}

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
              disabled={credential.data.isManaged}
            >
              Save
            </Button>
          </div>

          <updateMutator.RenderError />
        </form>
      </Box>

      <Spacer size={20} />

      <DeleteResourceDangerZone
        description="Delete these auth credentials and remove them from your saved provider authentication settings."
        buttonLabel="Delete Auth Credentials"
        confirmTitle="Delete auth credentials"
        confirmDescription="Are you sure you want to delete these auth credentials?"
        loading={deleteMutator.isLoading}
        success={deleteMutator.isSuccess}
        disabled={credential.data.isManaged}
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
                  'auth-credentials'
                )
              : Paths.instance.providerAuthCredentials(
                  instance.data?.organization,
                  instance.data?.project,
                  instance.data
                )
          );
        }}
      >
        {credential.data.isManaged ? (
          <Callout color="blue">
            Managed auth credentials cannot be deleted from the dashboard.
          </Callout>
        ) : null}
      </DeleteResourceDangerZone>
    </>
  ));
};
