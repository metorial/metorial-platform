import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from '@metorial/data-hooks';
import { Button, Flex, Group, Input, Spacer } from '@metorial/ui';
import { useCreateUser } from '../../hooks';
import { BackLink } from '../../components/BackLink';
import { FormWrapper } from '../../components/styled';

export let UserCreate = () => {
  let navigate = useNavigate();
  let { tenantId } = useParams<{ tenantId: string }>();
  let createUser = useCreateUser();

  let form = useForm({
    initialValues: {
      name: '',
      identifier: ''
    },
    onSubmit: async values => {
      if (!tenantId) return;

      let [, error] = await createUser.mutate({
        tenantId,
        name: values.name.trim(),
        identifier: values.identifier.trim()
      });

      if (!error) {
        navigate(`/tenants/${tenantId}/users`);
      }
    },
    schema: yup =>
      yup.object({
        name: yup.string().required(),
        identifier: yup.string().required()
      })
  });

  return (
    <Flex direction="column" gap={24}>
      <BackLink to={`/tenants/${tenantId}/users`}>Back to Users</BackLink>

      <FormWrapper>
        <Group.Wrapper>
          <Group.Header
            title="Create User"
            description="Create a new user who can publish slates and access the registry API. The identifier becomes their scope (@identifier)."
          />
          <Group.Content>
            <form onSubmit={form.handleSubmit}>
              <Flex direction="column" gap={20}>
                <Input
                  label="Name"
                  description="A display name for the user"
                  placeholder="John Doe"
                  value={form.values.name}
                  onInput={v => form.setFieldValue('name', v)}
                  required
                />
                <form.RenderError field="name" />

                <Input
                  label="Identifier"
                  description={`Lowercase letters, numbers, and hyphens only. This becomes the user's scope: @${form.values.identifier || 'identifier'}`}
                  placeholder="johndoe"
                  value={form.values.identifier}
                  onInput={v => form.setFieldValue('identifier', v.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  pattern="[a-z0-9-]+"
                  required
                />
                <form.RenderError field="identifier" />

                <createUser.RenderError />

                <Spacer size={8} />

                <Flex gap={12}>
                  <Button type="submit" loading={createUser.isLoading}>
                    Create User
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate(`/tenants/${tenantId}/users`)}>
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
