import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { DetailsSettingsLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useChatConnection,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button, confirm, Input, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';

export let ChatConnectionSettingsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { chatConnectionId } = useParams();
  let chatConnection = useChatConnection(instance.data?.id, chatConnectionId);
  let navigate = useNavigate();
  let updateMutator = chatConnection.useUpdateMutator();
  let deleteMutator = chatConnection.useDeleteMutator();

  let form = useForm({
    initialValues: {
      name: chatConnection.data?.name ?? '',
      description: chatConnection.data?.description ?? ''
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

  return renderWithLoader({ chatConnection })(({ chatConnection }) => (
    <DetailsSettingsLayout>
      <Box
        title="Connection Settings"
        description="Modify the saved details for this chat connection."
      >
        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={15} />

          <Input
            label="Description"
            {...form.getFieldProps('description')}
            as="textarea"
            minRows={5}
          />
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
        description="Delete this chat connection and all of its instances, chats and events."
      >
        <Button
          size="2"
          color="red"
          loading={deleteMutator.isLoading}
          success={deleteMutator.isSuccess}
          onClick={() =>
            confirm({
              title: `Delete ${chatConnection.data.name}?`,
              description: `Are you sure you want to delete ${chatConnection.data.name}?`,
              onConfirm: async () => {
                let [res] = await deleteMutator.mutate(undefined as never);
                if (res) {
                  navigate(
                    Paths.instance.chatConnections(
                      organization.data,
                      project.data,
                      instance.data
                    )
                  );
                }
              }
            })
          }
        >
          Delete Connection
        </Button>
      </Box>
    </DetailsSettingsLayout>
  ));
};
