import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Button, confirm, Input, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { useMagicMcpServer } from '../../../../state/consumer/magicMcpServer';

export let MagicMcpServerConfigPage = () => {
  let { magicMcpServerId } = useParams();
  let server = useMagicMcpServer(magicMcpServerId);
  let updateMutator = server.useUpdateMutator();
  let deleteMutator = server.useDeleteMutator();

  let form = useForm({
    initialValues: {
      name: server.data?.name ?? '',
      description: server.data?.description ?? ''
    },
    onSubmit: async values => {
      await updateMutator.mutate({
        name: values.name,
        description: values.description ?? undefined
      });
    },
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required'),
        description: yup.string()
      }) as any
  });

  return renderWithLoader({ server })(({ server }) => (
    <>
      <Box
        title="Configuration"
        description="Manage the configuration for this Magic MCP Server."
      >
        <form onSubmit={form.handleSubmit}>
          <Input
            label="Name"
            description="The name of the Magic MCP Server."
            {...form.getFieldProps('name')}
          />
          <form.RenderError field="name" />

          <Spacer height={15} />

          <Input
            label="Description"
            description="The description of the Magic MCP Server."
            {...form.getFieldProps('description')}
          />
          <form.RenderError field="description" />

          <Spacer height={15} />

          <Button
            type="submit"
            size="2"
            loading={updateMutator.isLoading}
            success={updateMutator.isSuccess}
          >
            Save Changes
          </Button>
        </form>
      </Box>

      <Spacer height={20} />

      <Box
        title="Danger Zone"
        description="Delete this Magic MCP Server. This action cannot be undone."
      >
        <Button
          size="2"
          loading={deleteMutator.isLoading}
          onClick={async () => {
            confirm({
              title: 'Delete Magic MCP Server',
              description:
                'Are you sure you want to delete this Magic MCP Server? This action cannot be undone.',
              onConfirm: async () => {
                await deleteMutator.mutate({});
              }
            });
          }}
        >
          Delete Magic MCP Server
        </Button>
      </Box>
    </>
  ));
};
