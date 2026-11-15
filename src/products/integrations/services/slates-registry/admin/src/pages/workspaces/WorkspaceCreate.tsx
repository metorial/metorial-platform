import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from '@metorial-io/data-hooks';
import { Button, Input, Flex, Group, Spacer } from '@metorial-io/ui';
import { useCreateWorkspace } from '../../hooks';
import { BackLink } from '../../components/BackLink';
import { FormWrapper } from '../../components/styled';

export let WorkspaceCreate = () => {
  let navigate = useNavigate();
  let { tenantId } = useParams<{ tenantId: string }>();
  let createWorkspace = useCreateWorkspace();

  let form = useForm({
    initialValues: {
      name: '',
      identifier: '',
      description: ''
    },
    onSubmit: async values => {
      if (!tenantId) return;
      let [, error] = await createWorkspace.mutate({
        tenantId,
        name: values.name,
        identifier: values.identifier,
        description: values.description.trim() || undefined
      });
      if (!error) {
        navigate(`/tenants/${tenantId}/workspaces`);
      }
    },
    schema: yup =>
      yup.object({
        name: yup.string().required(),
        identifier: yup.string().required(),
        description: yup.string().default('')
      })
  });

  return (
    <Flex direction="column" gap={24}>
      <BackLink to={`/tenants/${tenantId}/workspaces`}>Back to Workspaces</BackLink>

      <FormWrapper>
        <Group.Wrapper>
          <Group.Header
            title="Create Workspace"
            description="Create a new workspace for this tenant"
          />
          <Group.Content>
            <form onSubmit={form.handleSubmit}>
              <Flex direction="column" gap={20}>
                <Input
                  label="Name"
                  description="A display name for the workspace"
                  value={form.values.name}
                  onInput={v => form.setFieldValue('name', v)}
                  placeholder="My Workspace"
                  required
                />
                <form.RenderError field="name" />

                <Input
                  label="Identifier"
                  description="Lowercase letters, numbers, and hyphens only"
                  value={form.values.identifier}
                  onInput={v => form.setFieldValue('identifier', v)}
                  placeholder="my-workspace"
                  pattern="[a-z0-9-]+"
                  required
                />
                <form.RenderError field="identifier" />

                <Input
                  label="Description"
                  description="Optional description for the workspace"
                  value={form.values.description}
                  onInput={v => form.setFieldValue('description', v)}
                  placeholder="A brief description of this workspace"
                />
                <form.RenderError field="description" />

                <createWorkspace.RenderError />

                <Spacer size={8} />

                <Flex gap={12}>
                  <Button type="submit" loading={createWorkspace.isLoading}>
                    Create Workspace
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
}
