import { useForm } from '@metorial-io/data-hooks';
import { Button, Flex, Group, Select, Spacer, Text } from '@metorial-io/ui';
import { useNavigate, useParams } from 'react-router-dom';
import { BackLink } from '../../components/BackLink';
import { FileInput, FormWrapper } from '../../components/styled';
import { usePublishNewSlate } from '../../hooks';

export let SlateCreate = () => {
  let { tenantId } = useParams<{ tenantId: string }>();
  let navigate = useNavigate();
  let publishNewSlate = usePublishNewSlate();

  let form = useForm({
    initialValues: {
      file: null as File | null,
      access: 'public' as 'public' | 'private'
    },
    onSubmit: async values => {
      if (!values.file || !tenantId) return;

      let buffer = await values.file.arrayBuffer();
      let base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      let [result, error] = await publishNewSlate.mutate({
        tenantId,
        contentBase64: base64,
        access: values.access
      });

      if (!error && result?.slateId) {
        navigate(`/tenants/${tenantId}/slates/${result.slateId}`);
      } else if (!error) {
        navigate(`/tenants/${tenantId}/slates`);
      }
    },
    schema: yup =>
      yup.object({
        file: yup.mixed<File>().nullable().defined(),
        access: yup.string().oneOf(['public', 'private']).required()
      })
  });

  return (
    <Flex direction="column" gap={24}>
      <BackLink to={`/tenants/${tenantId}/slates`}>Back to Slates</BackLink>

      <FormWrapper>
        <Group.Wrapper>
          <Group.Header
            title="Create New Slate"
            description="Publish a new slate to the registry. The ZIP must contain a slate.json at the root with a name field matching @scope/identifier."
          />
          <Group.Content>
            <form onSubmit={form.handleSubmit}>
              <Flex direction="column" gap={20}>
                <Flex direction="column" gap={6}>
                  <Text size="2" weight="medium">
                    Slate Package (ZIP)
                  </Text>
                  <FileInput
                    type="file"
                    accept=".zip"
                    onChange={e => form.setFieldValue('file', e.target.files?.[0] ?? null)}
                    required
                  />
                  <form.RenderError field="file" />
                  <Text size="1" color="gray600">
                    ZIP file with slate.json at root (not in a subfolder). Create with: cd
                    your-slate && zip -r slate.zip .
                  </Text>
                </Flex>

                <Select
                  label="Access Level"
                  description="Private slates are only visible to authenticated users. Public slates are discoverable by anyone."
                  value={form.values.access}
                  onChange={value =>
                    form.setFieldValue('access', value as 'public' | 'private')
                  }
                  items={[
                    { id: 'private', label: 'Private' },
                    { id: 'public', label: 'Public' }
                  ]}
                />
                <form.RenderError field="access" />

                <publishNewSlate.RenderError />

                <Spacer size={8} />

                <Flex gap={12}>
                  <Button
                    type="submit"
                    loading={publishNewSlate.isLoading}
                    disabled={!form.values.file}
                  >
                    Create Slate
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(`/tenants/${tenantId}/slates`)}
                  >
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
};
