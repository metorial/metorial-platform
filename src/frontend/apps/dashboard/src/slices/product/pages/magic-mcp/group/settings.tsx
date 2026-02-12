import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useMagicMcpGroup } from '@metorial/state';
import { Button, confirm, Input, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';

export let MagicMcpGroupSettingsPage = () => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();

  let { magicMcpGroupId } = useParams();
  let group = useMagicMcpGroup(instance.data?.instanceId, magicMcpGroupId);

  let updateMutator = group.useUpdateMutator();
  let deleteMutator = group.useDeleteMutator();

  let form = useForm({
    initialValues: {
      name: group.data?.name ?? '',
      description: group.data?.description ?? ''
    },
    onSubmit: async values => {
      let [res] = await updateMutator.mutate({
        ...values
      });
    },
    schema: yup =>
      yup.object().shape({
        name: yup.string().required('Name is required'),
        description: yup.string()
      }) as any
  });

  return renderWithLoader({ group })(({ group }) => (
    <>
      <Box
        title="Magic MCP Group Settings"
        description="Modify the settings of this Magic MCP group."
      >
        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer height={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer height={15} />

          <Button
            size="2"
            type="submit"
            loading={updateMutator.isLoading}
            success={updateMutator.isSuccess}
          >
            Save
          </Button>
        </form>
      </Box>

      <Spacer height={20} />

      <Box
        title="Delete Magic MCP Group"
        description="Permanently delete this Magic MCP group. This action cannot be undone."
      >
        <Button
          size="2"
          color="red"
          loading={deleteMutator.isLoading}
          success={deleteMutator.isSuccess}
          onClick={async () => {
            confirm({
              title: `Delete Magic MCP group`,
              description: `Are you sure you want to delete this Magic MCP group?`,
              onConfirm: async () => {
                let [res] = await deleteMutator.mutate({});
                if (res) {
                  navigate(
                    Paths.instance.magicMcp.groups(
                      instance.data?.organization,
                      instance.data?.project,
                      instance.data
                    )
                  );
                }
              }
            });
          }}
        >
          Delete Magic MCP Group
        </Button>
      </Box>
    </>
  ));
};
