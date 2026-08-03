import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIntegrationInstance
} from '@metorial/state';
import { Button, Input, Spacer, confirm } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';

export let IntegrationInstanceSettingsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { integrationInstanceId } = useParams();
  let integrationInstance = useIntegrationInstance(instance.data?.id, integrationInstanceId);
  let navigate = useNavigate();
  let updateMutator = integrationInstance.useUpdateMutator();
  let deleteMutator = integrationInstance.useDeleteMutator();

  let form = useForm({
    initialValues: {
      name: integrationInstance.data?.name ?? '',
      description: integrationInstance.data?.description ?? ''
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

  return renderWithLoader({ integrationInstance })(({ integrationInstance }) => {
    return (
      <>
        <Box
          title="Instance Settings"
          description="Modify the saved details for this integration instance."
        >
          <form onSubmit={form.handleSubmit}>
            <Input label="Name" required {...form.getFieldProps('name')} />
            <form.RenderError field="name" />

            <Spacer size={15} />

            <Input label="Description" {...form.getFieldProps('description')} />
            <form.RenderError field="description" />

            <Spacer size={15} />

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                size="2"
                type="submit"
                loading={updateMutator.isPending}
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
          description="Delete this integration instance and remove any provider overrides attached to it."
        >
          <Button
            size="2"
            color="red"
            loading={deleteMutator.isPending}
            onClick={() =>
              confirm({
                title: `Delete ${integrationInstance.data?.name ?? 'this instance'}?`,
                description: `Are you sure you want to delete this instance? This action cannot be undone.`,
                confirmText: 'Delete',
                onConfirm: async () => {
                  let [deleted] = await deleteMutator.mutate(undefined as never);
                  if (deleted) {
                    navigate(
                      Paths.instance.integration(
                        organization.data,
                        project.data,
                        instance.data,
                        integrationInstance.data.integrationId
                      )
                    );
                  }
                }
              })
            }
          >
            Delete Instance
          </Button>
          <deleteMutator.RenderError />
        </Box>
      </>
    );
  });
};
