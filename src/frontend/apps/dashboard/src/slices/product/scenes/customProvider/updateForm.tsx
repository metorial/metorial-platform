import { CustomProvidersGetOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCreateCustomProviderVersion,
  useCurrentInstance,
  useCustomProvider
} from '@metorial/state';
import { Button, Group, Input, Select, Spacer, toast } from '@metorial/ui';
import { useNavigate } from 'react-router-dom';
import { FormPage } from '../form/page';
import {
  type CustomProviderRemoteProtocol,
  getCustomProviderRemoteProtocolFromUrl
} from './utils';

export let CustomProviderUpdateForm = (p: { customProvider?: CustomProvidersGetOutput }) => {
  let instance = useCurrentInstance();
  let customProvider = useCustomProvider(instance.data?.id, p.customProvider?.id);
  let navigate = useNavigate();
  let updateMutator = customProvider.useUpdateMutator();
  let createVersionMutator = useCreateCustomProviderVersion();
  let customProviderData = customProvider.data ?? p.customProvider;
  let isExternalProvider = Boolean(customProviderData?.draft?.remoteMcpServer);
  let currentRemoteUrl = customProviderData?.draft?.remoteMcpServer?.url ?? '';
  let currentRemoteProtocol =
    customProviderData?.draft?.remoteMcpServer?.transport ??
    getCustomProviderRemoteProtocolFromUrl(currentRemoteUrl);
  let isSaving = updateMutator.isLoading || createVersionMutator.isLoading;
  let isSaved = !isSaving && (updateMutator.isSuccess || createVersionMutator.isSuccess);

  let form = useForm({
    initialValues: {
      name: customProviderData?.name ?? '',
      description: customProviderData?.description ?? '',
      remoteUrl: currentRemoteUrl,
      remoteProtocol: currentRemoteProtocol
    },
    updateInitialValues: true,
    onSubmit: async values => {
      console.log('Submitting with values:', values);

      if (!instance.data) return;
      if (!customProviderData) return;

      let nextRemoteUrl = values.remoteUrl.trim();
      let nextRemoteProtocol: 'sse' | 'streamable_http' =
        values.remoteProtocol == 'sse' ? 'sse' : 'streamable_http';
      let didUpdateRemote =
        isExternalProvider &&
        (nextRemoteUrl !== currentRemoteUrl || nextRemoteProtocol !== currentRemoteProtocol);

      await updateMutator.mutate({
        name: values.name.trim(),
        description: values.description.trim() || undefined
      });

      if (didUpdateRemote) {
        let [version] = await createVersionMutator.mutate({
          instanceId: instance.data.id,
          customProviderId: customProviderData.id,
          from: {
            type: 'remote',
            remoteUrl: values.remoteUrl.trim(),
            protocol: nextRemoteProtocol
          }
        });

        if (version) {
          toast.success('External provider update started');
          await customProvider.refetch();

          navigate(
            Paths.instance.customProvider(
              instance.data.organization,
              instance.data.project,
              instance.data,
              customProviderData.id,
              'versions',
              { version_id: version.id }
            ),
            {
              state: {
                category: 'external'
              }
            }
          );
        }
      }
    },
    schema: yup =>
      isExternalProvider
        ? yup.object({
            name: yup.string().trim().required('Name is required'),
            description: yup.string(),
            remoteUrl: isExternalProvider
              ? yup
                  .string()
                  .trim()
                  .url('Remote URL must be a valid URL')
                  .required('Remote URL is required')
              : yup.string(),
            remoteProtocol: yup
              .mixed<CustomProviderRemoteProtocol>()
              .oneOf(['sse', 'streamable_http'])
              .required('Transport protocol is required')
          })
        : (yup.object({
            name: yup.string().trim().required('Name is required'),
            description: yup.string(),
            remoteUrl: yup.string().optional(),
            remoteProtocol: yup.mixed<CustomProviderRemoteProtocol>().optional()
          }) as any)
  });

  return (
    <FormPage>
      <Group.Wrapper>
        <Group.Header
          title="General"
          description={
            isExternalProvider
              ? 'Update the details of your external provider. Changing the remote URL publishes a new version.'
              : 'Update the details of your custom provider.'
          }
        />

        <Group.Content>
          <form onSubmit={form.handleSubmit}>
            <Input label="Name" {...form.getFieldProps('name')} />
            <form.RenderError field="name" />

            <Spacer size={15} />

            <Input label="Description" {...form.getFieldProps('description')} />
            <form.RenderError field="description" />

            {isExternalProvider && (
              <>
                <Spacer size={15} />

                <Input
                  label="Remote URL"
                  description="Changing this URL publishes a new version for the external provider."
                  {...form.getFieldProps('remoteUrl')}
                />
                <form.RenderError field="remoteUrl" />

                <Spacer size={15} />

                <Select
                  value={String(form.values.remoteProtocol || '')}
                  label="MCP Transport Protocol"
                  description="Use the protocol supported by the remote MCP provider."
                  items={[
                    { label: 'SSE (Server-Sent Events)', id: 'sse' },
                    { label: 'Streamable HTTP', id: 'streamable_http' }
                  ]}
                  onChange={v => form.setFieldValue('remoteProtocol', v)}
                />
                <form.RenderError field="remoteProtocol" />
              </>
            )}

            <Spacer size={15} />

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button size="2" type="submit" loading={isSaving} success={isSaved}>
                Save
              </Button>
            </div>

            {updateMutator.error && <updateMutator.RenderError />}
            {createVersionMutator.error && <createVersionMutator.RenderError />}
          </form>
        </Group.Content>
      </Group.Wrapper>
    </FormPage>
  );
};
