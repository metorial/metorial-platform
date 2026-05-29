import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from '@metorial/data-hooks';
import { Button, Input, Flex, Group, Spacer } from '@metorial/ui';
import { useCreateSubRegistry } from '../../hooks';
import { BackLink } from '../../components/BackLink';
import { FormWrapper } from '../../components/styled';

export let SubRegistryCreate = () => {
  let navigate = useNavigate();
  let { tenantId } = useParams<{ tenantId: string }>();
  let createSubRegistry = useCreateSubRegistry();

  let form = useForm({
    initialValues: {
      name: '',
      identifier: ''
    },
    onSubmit: async values => {
      if (!tenantId) return;
      let [, error] = await createSubRegistry.mutate({ tenantId, name: values.name, identifier: values.identifier });
      if (!error) {
        navigate(`/tenants/${tenantId}/sub-registries`);
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
      <BackLink to={`/tenants/${tenantId}/sub-registries`}>Back to Sub-Registries</BackLink>

      <FormWrapper>
        <Group.Wrapper>
          <Group.Header
            title="Create Sub-Registry"
            description="Create a new sub-registry for this tenant"
          />
          <Group.Content>
            <form onSubmit={form.handleSubmit}>
              <Flex direction="column" gap={20}>
                <Input
                  label="Name"
                  description="A display name for the sub-registry"
                  value={form.values.name}
                  onInput={v => form.setFieldValue('name', v)}
                  placeholder="My Sub-Registry"
                  required
                />
                <form.RenderError field="name" />

                <Input
                  label="Identifier"
                  description="Lowercase letters, numbers, and hyphens only"
                  value={form.values.identifier}
                  onInput={v => form.setFieldValue('identifier', v)}
                  placeholder="my-sub-registry"
                  pattern="[a-z0-9-]+"
                  required
                />
                <form.RenderError field="identifier" />

                <createSubRegistry.RenderError />

                <Spacer size={8} />

                <Flex gap={12}>
                  <Button type="submit" loading={createSubRegistry.isLoading}>
                    Create Sub-Registry
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate(`/tenants/${tenantId}/sub-registries`)}>
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
