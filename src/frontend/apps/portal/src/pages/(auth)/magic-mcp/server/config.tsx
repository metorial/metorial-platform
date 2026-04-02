import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Button, Callout, confirm, Input, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';
import { useMagicMcpServer } from '../../../../state/consumer/magicMcpServer';
import { usePaths } from '../../../../state/portal/path';

export let MagicMcpServerConfigPage = () => {
  let { magicMcpServerId } = useParams();
  let navigate = useNavigate();
  let paths = usePaths();
  let server = useMagicMcpServer(magicMcpServerId);
  let updateMutator = server.useUpdateMutator();
  let deleteMutator = server.useDeleteMutator();
  let form = useForm({
    initialValues: {
      name: server.data?.name ?? '',
      description: server.data?.description ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await updateMutator.mutate({
        name: values.name.trim(),
        description: values.description.trim() || undefined
      });
    },
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required'),
        description: yup.string()
      })
  });

  return renderWithLoader({ server })(({ server }) => {
    let isConsumerManaged = server.data.source == 'consumer_provider_template';

    return (
      <>
        {!isConsumerManaged && (
          <>
            <Callout color="orange">
              This Magic MCP server is managed by the portal administrator and can&apos;t be
              edited here.
            </Callout>
            <Spacer height={20} />
          </>
        )}

        <Box
          title="Settings"
          description="Rename this Magic MCP server or update its description."
        >
          <form
            onSubmit={async event => {
              if (!isConsumerManaged) {
                event.preventDefault();
                return;
              }

              await form.handleSubmit(event);
            }}
          >
            <Input
              label="Name"
              description="The name of the Magic MCP Server."
              disabled={!isConsumerManaged}
              {...form.getFieldProps('name')}
            />
            <form.RenderError field="name" />

            <Spacer height={15} />

            <Input
              label="Description"
              description="The description of the Magic MCP Server."
              disabled={!isConsumerManaged}
              {...form.getFieldProps('description')}
            />
            <form.RenderError field="description" />

            <Spacer height={15} />

            <Button
              type="submit"
              size="2"
              disabled={!isConsumerManaged || !form.values.name.trim()}
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
            disabled={!isConsumerManaged}
            loading={deleteMutator.isLoading}
            onClick={async () => {
              if (!isConsumerManaged) return;

              confirm({
                title: 'Delete Magic MCP Server',
                description:
                  'Are you sure you want to delete this Magic MCP Server? This action cannot be undone.',
                onConfirm: async () => {
                  let [result] = await deleteMutator.mutate({});
                  if (result) navigate(paths.magicMcpServers());
                }
              });
            }}
          >
            Delete Magic MCP Server
          </Button>
        </Box>
      </>
    );
  });
};
