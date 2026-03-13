import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useIdentity } from '@metorial/state';
import { Button, Input, Spacer, confirm } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';

export let IdentitySettingsPage = () => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let { identityId } = useParams();
  let identity = useIdentity(instance.data?.id, identityId);
  let updateMutator = identity.useUpdateMutator();
  let deleteMutator = identity.useDeleteMutator();

  let form = useForm({
    initialValues: {
      name: identity.data?.name ?? '',
      description: identity.data?.description ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await updateMutator.mutate({
        name: values.name.trim() || undefined,
        description: values.description.trim() || undefined
      });
    },
    schema: yup =>
      yup.object({
        name: yup.string().ensure(),
        description: yup.string().ensure()
      })
  });

  return renderWithLoader({ identity })(({ identity }) => (
    <>
      <Box title="Identity Settings" description="Modify the saved details for this identity.">
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

      <Box
        title="Danger Zone"
        description="Delete this identity and remove it from your identity management setup."
      >
        <Button
          size="2"
          color="red"
          loading={deleteMutator.isLoading}
          success={deleteMutator.isSuccess}
          onClick={() =>
            confirm({
              title: 'Delete identity',
              description: 'Are you sure you want to delete this identity?',
              onConfirm: async () => {
                let [res] = await deleteMutator.mutate({});
                if (res) {
                  navigate(
                    Paths.instance.identity.identities(
                      instance.data?.organization,
                      instance.data?.project,
                      instance.data
                    )
                  );
                }
              }
            })
          }
        >
          Delete Identity
        </Button>
      </Box>
    </>
  ));
};
