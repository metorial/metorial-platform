import { useNavigate } from 'react-router-dom';
import { useForm } from '@metorial-io/data-hooks';
import { Button, Input, Flex, Group, Spacer } from '@metorial-io/ui';
import { useCreateTenant } from '../../hooks';
import { BackLink } from '../../components/BackLink';
import { FormWrapper } from '../../components/styled';

export let TenantCreate = () => {
  let navigate = useNavigate();
  let createTenant = useCreateTenant();

  let form = useForm({
    initialValues: {
      name: '',
      identifier: ''
    },
    onSubmit: async values => {
      let [, error] = await createTenant.mutate({ name: values.name, identifier: values.identifier });
      if (!error) {
        navigate('/tenants');
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
      <BackLink to="/tenants">Back to Tenants</BackLink>

      <FormWrapper>
        <Group.Wrapper>
          <Group.Header
            title="Create Tenant"
            description="Add a new tenant to manage slates and resources"
          />
          <Group.Content>
            <form onSubmit={form.handleSubmit}>
              <Flex direction="column" gap={20}>
                <Input
                  label="Name"
                  description="A display name for the tenant"
                  value={form.values.name}
                  onInput={v => form.setFieldValue('name', v)}
                  placeholder="My Organization"
                  required
                />
                <form.RenderError field="name" />

                <Input
                  label="Identifier"
                  description="Lowercase letters, numbers, and hyphens only"
                  value={form.values.identifier}
                  onInput={v => form.setFieldValue('identifier', v)}
                  placeholder="my-org"
                  pattern="[a-z0-9-]+"
                  required
                />
                <form.RenderError field="identifier" />

                <createTenant.RenderError />

                <Spacer size={8} />

                <Flex gap={12}>
                  <Button type="submit" loading={createTenant.isLoading}>
                    Create Tenant
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate('/tenants')}>
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
