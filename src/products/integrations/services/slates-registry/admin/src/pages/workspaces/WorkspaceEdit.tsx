import { useNavigate, useParams } from 'react-router-dom';
import { renderWithLoader, useForm } from '@metorial-io/data-hooks';
import { Button, Flex, Group, Input } from '@metorial-io/ui';
import { useUpdateWorkspace, useWorkspace } from '../../hooks';
import { BackLink } from '../../components/BackLink';
import { FormWrapper, MonoCode } from '../../components/styled';

export let WorkspaceEdit = () => {
  let { tenantId, workspaceId } = useParams<{ tenantId: string; workspaceId: string }>();
  let navigate = useNavigate();
  let workspace = useWorkspace(tenantId, workspaceId!);
  let updateWorkspace = useUpdateWorkspace();

  let form = useForm({
    initialValues: {
      name: workspace.data?.name ?? '',
      description: workspace.data?.scope?.description ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      if (!tenantId) return;
      let [, error] = await updateWorkspace.mutate({
        tenantId,
        workspaceId: workspaceId!,
        name: values.name,
        description: values.description
      });
      if (!error) {
        navigate(`/tenants/${tenantId}/workspaces`);
      }
    },
    schema: yup =>
      yup.object({
        name: yup.string().required(),
        description: yup.string().default('')
      })
  });

  return renderWithLoader({ workspace })(({ workspace }) => {
    let workspaceData = workspace.data!;

    return (
      <Flex direction="column" gap={24}>
        <BackLink to={`/tenants/${tenantId}/workspaces`}>Back to Workspaces</BackLink>

        <FormWrapper>
          <Group.Wrapper>
            <Group.Header
              title="Edit Workspace"
              description={<MonoCode>{workspaceData.identifier}</MonoCode>}
            />
            <Group.Content>
              <form onSubmit={form.handleSubmit}>
                <Flex direction="column" gap={20}>
                  <Input
                    label="Name"
                    value={form.values.name}
                    onChange={e => form.setFieldValue('name', e.target.value)}
                    required
                  />
                  <form.RenderError field="name" />

                  <Input
                    as="textarea"
                    label="Description"
                    value={form.values.description}
                    onChange={e => form.setFieldValue('description', e.target.value)}
                    placeholder="Optional description"
                    minRows={3}
                  />
                  <form.RenderError field="description" />

                  <updateWorkspace.RenderError />

                  <Flex gap={12} style={{ marginTop: 8 }}>
                    <Button type="submit" loading={updateWorkspace.isLoading}>
                      Save Changes
                    </Button>
                    <Button type="button" variant="outline" onClick={() => navigate(`/tenants/${tenantId}/workspaces`)}>
                      Cancel
                    </Button>
                  </Flex>
                </Flex>
              </form>
            </Group.Content>
          </Group.Wrapper>
        </FormWrapper>
      </Flex>
    );
  });
}
