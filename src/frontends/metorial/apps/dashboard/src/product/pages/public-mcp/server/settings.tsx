import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  usePublicMcpServer
} from '@metorial/state';
import { Button, confirm, Input, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';
import { isValidPublicMcpSlug, type PublicMcpServer } from '../../../scenes/publicMcp/shared';

let DetailsForm = ({
  instanceId,
  server
}: {
  instanceId: string;
  server: PublicMcpServer;
}) => {
  let serverLoader = usePublicMcpServer(instanceId, server.id);
  let updateServer = serverLoader.useUpdateMutator();

  let form = useForm({
    initialValues: {
      name: server.name,
      slug: server.slug,
      description: server.description ?? '',
      maxActiveGrants: server.maxActiveGrants?.toString() ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      let maxActiveGrants = values.maxActiveGrants.trim();

      await updateServer.mutate({
        name: values.name.trim(),
        slug: values.slug,
        description: values.description.trim() || null,
        maxActiveGrants: maxActiveGrants ? Number(maxActiveGrants) : null
      });
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        slug: yup
          .string()
          .required('Slug is required')
          .test('slug', 'Use 3 to 48 lowercase letters, numbers, and single dashes', value =>
            isValidPublicMcpSlug(value ?? '')
          ),
        description: yup.string(),
        maxActiveGrants: yup
          .string()
          .test('positive', 'Enter a whole number greater than zero', value => {
            if (!value?.trim()) return true;
            let n = Number(value);
            return Number.isInteger(n) && n > 0;
          })
      })
  });

  let slugChanged = form.values.slug !== server.slug;

  return (
    <Box
      title="Details"
      description="Update how this server is named and where it's published."
    >
      <form onSubmit={form.handleSubmit}>
        <Input label="Name" required {...form.getFieldProps('name')} />
        <form.RenderError field="name" />

        <Spacer height={15} />

        <Input
          label="Slug"
          description={
            slugChanged
              ? 'Changing the slug changes the connect URL. Clients using the old URL stop working.'
              : 'Part of the public connect URL.'
          }
          required
          {...form.getFieldProps('slug')}
          onChange={e => form.setFieldValue('slug', e.target.value.trim().toLowerCase())}
        />
        <form.RenderError field="slug" />

        <Spacer height={15} />

        <Input label="Description" {...form.getFieldProps('description')} />
        <form.RenderError field="description" />

        <Spacer height={15} />

        <Input
          label="Maximum Connected Users"
          description="Leave empty for no limit."
          inputMode="numeric"
          {...form.getFieldProps('maxActiveGrants')}
        />
        <form.RenderError field="maxActiveGrants" />

        <Spacer height={15} />

        <updateServer.RenderError />

        <Button
          size="2"
          type="submit"
          loading={updateServer.isLoading}
          success={updateServer.isSuccess}
        >
          Save
        </Button>
      </form>
    </Box>
  );
};

let DeleteBox = ({ instanceId, server }: { instanceId: string; server: PublicMcpServer }) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let serverLoader = usePublicMcpServer(instanceId, server.id);
  let deleteServer = serverLoader.useDeleteMutator();

  return (
    <Box
      title="Delete Server"
      description="Deleting the server revokes everyone's access. The slug stays reserved, and this cannot be undone."
    >
      <deleteServer.RenderError />

      <Button
        size="2"
        color="red"
        loading={deleteServer.isLoading}
        success={deleteServer.isSuccess}
        onClick={() =>
          confirm({
            title: 'Delete Public MCP Server',
            description: `All users connected to ${server.name} lose access immediately.`,
            confirmText: 'Delete',
            onConfirm: async () => {
              let [res] = await deleteServer.mutate({});
              if (!res) return;

              navigate(
                Paths.instance.publicMcp.servers(
                  organization.data,
                  project.data,
                  instance.data
                )
              );
            }
          })
        }
      >
        Delete Server
      </Button>
    </Box>
  );
};

export let PublicMcpServerSettingsPage = () => {
  let instance = useCurrentInstance();
  let { publicMcpServerId } = useParams();
  let server = usePublicMcpServer(instance.data?.id, publicMcpServerId);

  return renderWithLoader({ instance, server })(({ instance, server }) => (
    <>
      <DetailsForm instanceId={instance.data.id} server={server.data} />

      {server.data.status != 'archived' && server.data.status != 'deleted' && (
        <>
          <Spacer height={20} />
          <DeleteBox instanceId={instance.data.id} server={server.data} />
        </>
      )}
    </>
  ));
};
