import { useNavigate, useParams } from 'react-router-dom';
import { renderWithLoader, useForm } from '@metorial-io/data-hooks';
import { Button, Flex, Group, Text, Select, Callout } from '@metorial-io/ui';
import { usePublishSlate, useSlate } from '../../hooks';
import { BackLink } from '../../components/BackLink';
import { FormWrapper, FileInput, MonoCode } from '../../components/styled';

export let SlatePublish = () => {
  let { tenantId, slateId } = useParams<{ tenantId: string; slateId: string }>();
  let navigate = useNavigate();
  let slate = useSlate(tenantId, slateId!);
  let publishSlate = usePublishSlate();

  let form = useForm({
    initialValues: {
      file: null as File | null,
      access: 'private' as 'public' | 'private'
    },
    onSubmit: async values => {
      if (!values.file || !tenantId || !slate.data) return;

      let buffer = await values.file.arrayBuffer();
      let base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      let parts = slate.data.fullIdentifier.split('/');
      let scopeIdentifier = parts[0]!;
      let slateIdentifier = parts[1]!;

      let [, error] = await publishSlate.mutate({
        tenantId,
        slateId: slateId!,
        scopeIdentifier,
        slateIdentifier,
        contentBase64: base64,
        access: values.access
      });

      if (!error) {
        navigate(`/tenants/${tenantId}/slates/${slateId}`);
      }
    },
    schema: yup =>
      yup.object({
        file: yup.mixed<File>().nullable().defined(),
        access: yup.string().oneOf(['public', 'private']).required()
      })
  });

  return renderWithLoader({ slate })(({ slate }) => {
    let slateData = slate.data!;

    return (
      <Flex direction="column" gap={24}>
        <BackLink to={`/tenants/${tenantId}/slates/${slateId}`}>Back to Slate</BackLink>

        <FormWrapper>
          <Group.Wrapper>
            <Group.Header
              title="Publish New Version"
              description={<MonoCode>{slateData.fullIdentifier}</MonoCode>}
            />
            <Group.Content>
              {slateData.currentVersion && (
                <Callout color="gray" style={{ marginBottom: 20 }}>
                  <Text size="2" color="gray600">
                    Current version:{' '}
                    <Text as="span" weight="medium" color="gray900">
                      v{slateData.currentVersion.version}
                    </Text>
                  </Text>
                </Callout>
              )}

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
                    <Text size="1" color="gray500">
                      Upload a ZIP file containing slate.json and other assets
                    </Text>
                  </Flex>

                  <Select
                    label="Access Level"
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

                  <publishSlate.RenderError />

                  <Flex gap={12} style={{ marginTop: 8 }}>
                    <Button
                      type="submit"
                      disabled={!form.values.file}
                      loading={publishSlate.isLoading}
                    >
                      Publish Version
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate(`/tenants/${tenantId}/slates/${slateId}`)}
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
  });
};
