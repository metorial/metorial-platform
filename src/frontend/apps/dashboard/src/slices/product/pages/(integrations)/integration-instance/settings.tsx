import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIntegrationInstance
} from '@metorial/state';
import { Button, Dialog, Flex, Input, Spacer, confirm } from '@metorial/ui';
import { useNavigate, useParams } from 'react-router-dom';

export let IntegrationInstanceSettingsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { integrationInstanceId } = useParams();
  let integrationInstance = useIntegrationInstance(instance.data?.id, integrationInstanceId);
  let integrationInstanceRoot = integrationInstance;
  let navigate = useNavigate();

  return renderWithLoader({ integrationInstance })(({ integrationInstance }) => {
    let update = integrationInstanceRoot.useUpdateMutator();
    let deleteMutator = integrationInstanceRoot.useDeleteMutator();
    let form = useForm({
      initialValues: {
        name: integrationInstance.data.name ?? '',
        description: integrationInstance.data.description ?? ''
      },
      enableReinitialize: true,
      onSubmit: async values => {
        await update.mutate({
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

    return (
      <form onSubmit={form.handleSubmit}>
        <Input label="Name" required {...form.getFieldProps('name')} />
        <form.RenderError field="name" />
        <Spacer size={10} />
        <Input label="Description" {...form.getFieldProps('description')} />
        <Spacer size={15} />
        <Dialog.Actions>
          <Button type="submit" loading={update.isPending}>
            Save Changes
          </Button>
          <Button
            type="button"
            color="red"
            variant="soft"
            loading={deleteMutator.isPending}
            onClick={() =>
              confirm({
                title: 'Delete instance',
                description: `Delete ${integrationInstance.data.name}?`,
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
        </Dialog.Actions>
        <Flex direction="column" gap={4}>
          <update.RenderError />
          <deleteMutator.RenderError />
        </Flex>
      </form>
    );
  });
};
