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
import { getCustomServerRemoteProtocolFromUrl } from './utils';

export let CustomServerUpdateForm = (p: { customServer?: CustomProvidersGetOutput }) => {
  let instance = useCurrentInstance();
  let customServer = useCustomProvider(instance.data?.id, p.customServer?.id);
  let navigate = useNavigate();
  let updateMutator = customServer.useUpdateMutator();
  let createVersionMutator = useCreateCustomProviderVersion();
  let customServerData = customServer.data ?? p.customServer;
  let isExternalProvider = Boolean(customServerData?.draft?.remoteMcpServer);
  let currentRemoteUrl = customServerData?.draft?.remoteMcpServer?.url ?? '';
  let currentRemoteProtocol =
    customServerData?.draft?.remoteMcpServer?.transport ??
    getCustomServerRemoteProtocolFromUrl(currentRemoteUrl);
  let isSaving = updateMutator.isLoading || createVersionMutator.isLoading;
  let isSaved =
    !isSaving && (updateMutator.isSuccess || createVersionMutator.isSuccess);
  let form = useForm({
    initialValues: {
      name: customServerData?.name ?? '',
      description: customServerData?.description ?? '',
      remoteUrl: currentRemoteUrl,
      remoteProtocol: currentRemoteProtocol
    },
    updateInitialValues: true,
    onSubmit: async values => {
      if (!instance.data) return;
      if (!customServerData) return;

      let nextName = values.name.trim() || undefined;
      let nextDescription = values.description.trim() || undefined;
      let currentName = customServerData.name || undefined;
      let currentDescription = customServerData.description || undefined;
      let nextRemoteUrl = values.remoteUrl.trim();
      let nextRemoteProtocol: 'sse' | 'streamable_http' =
        values.remoteProtocol == 'sse' ? 'sse' : 'streamable_http';
      let didUpdateDetails =
        nextName !== currentName || nextDescription !== currentDescription;
      let didUpdateRemote =
        isExternalProvider &&
        (nextRemoteUrl !== currentRemoteUrl || nextRemoteProtocol !== currentRemoteProtocol);

      if (didUpdateDetails) {
        await updateMutator.mutate({
          name: values.name.trim(),
          description: values.description.trim() || undefined
        });
      }

      if (didUpdateRemote) {
        let [version] = await createVersionMutator.mutate({
          instanceId: instance.data.id,
          customProviderId: customServerData.id,
          from: {
            type: 'remote',
            remoteUrl: values.remoteUrl.trim(),
            protocol: nextRemoteProtocol
          }
        });

        if (version) {
          toast.success('External provider update started');
          await customServer.refetch();

          navigate(
            Paths.instance.customProvider(
              instance.data.organization,
              instance.data.project,
              instance.data,
              customServerData.id,
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

        return;
      }

      if (didUpdateDetails) {
        toast.success('Provider updated');
        await customServer.refetch();
      }
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string().ensure(),
        remoteUrl: isExternalProvider
          ? yup
              .string()
              .trim()
              .url('Remote URL must be a valid URL')
              .required('Remote URL is required')
          : yup.string().ensure(),
        remoteProtocol: isExternalProvider
          ? yup
              .string()
              .oneOf(['sse', 'streamable_http'])
              .required('Transport protocol is required')
          : yup.string().ensure()
      })
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
