import { CustomProvidersGetOutput } from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  useCreateCustomProviderVersion,
  useCurrentInstance,
  useCustomProvider
} from '@metorial/state';
import { Input, Select, toast } from '@metorial/ui';
import { useNavigate } from 'react-router-dom';
import { FormBox } from '../form/box';
import { Field } from '../form/field';
import { FormPage } from '../form/page';
import { getCustomServerRemoteProtocolFromUrl } from './utils';

export let CustomServerUpdateForm = (p: { customServer?: CustomProvidersGetOutput }) => {
  let instance = useCurrentInstance();
  let customServer = useCustomProvider(instance.data?.id, p.customServer?.id);
  let navigate = useNavigate();
  let updateMutator = customServer.useUpdateMutator();
  let createVersionMutator = useCreateCustomProviderVersion();
  let isExternalProvider = Boolean(customServer.data?.draft?.remoteMcpServer);
  let currentRemoteUrl = customServer.data?.draft?.remoteMcpServer?.url ?? '';
  let currentRemoteProtocol =
    customServer.data?.draft?.remoteMcpServer?.transport ??
    getCustomServerRemoteProtocolFromUrl(currentRemoteUrl);
  let formMutator = {
    RenderError: () => (
      <>
        {updateMutator.error && <updateMutator.RenderError />}
        {createVersionMutator.error && <createVersionMutator.RenderError />}
      </>
    ),
    error: updateMutator.error ?? createVersionMutator.error,
    isLoading: updateMutator.isLoading || createVersionMutator.isLoading,
    isSuccess: updateMutator.isSuccess || createVersionMutator.isSuccess
  };

  return (
    <FormPage>
      <FormBox
        title="General"
        description={
          isExternalProvider
            ? 'Update the details of your external provider. Changing the remote URL publishes a new version.'
            : 'Update the details of your custom provider.'
        }
        schema={yup =>
          yup.object({
            name: yup.string().optional(),
            description: yup.string().optional(),
            remoteUrl: isExternalProvider
              ? yup.string().url('Remote URL must be a valid URL').required('Remote URL is required')
              : yup.string().optional(),
            remoteProtocol: isExternalProvider
              ? yup
                  .string()
                  .oneOf(['sse', 'streamable_http'])
                  .required('Transport protocol is required')
              : yup.string().optional()
          })
        }
        initialValues={{
          name: customServer.data?.name ?? '',
          description: customServer.data?.description ?? '',
          remoteUrl: currentRemoteUrl,
          remoteProtocol: currentRemoteProtocol
        }}
        mutators={[formMutator]}
        onSubmit={async values => {
          if (!instance.data) return;
          if (!customServer.data) return;

          let nextName = values.name || undefined;
          let nextDescription = values.description || undefined;
          let currentName = customServer.data.name || undefined;
          let currentDescription = customServer.data.description || undefined;
          let nextRemoteUrl = values.remoteUrl?.trim();
          let nextRemoteProtocol =
            values.remoteProtocol == 'sse' ? 'sse' : 'streamable_http';
          let didUpdateDetails =
            nextName !== currentName || nextDescription !== currentDescription;
          let didUpdateRemote =
            isExternalProvider &&
            (nextRemoteUrl !== currentRemoteUrl ||
              nextRemoteProtocol !== currentRemoteProtocol);

          if (didUpdateDetails) {
            await updateMutator.mutate({
              name: nextName,
              description: nextDescription
            });
          }

          if (didUpdateRemote) {
            let [version] = await createVersionMutator.mutate({
              instanceId: instance.data.id,
              customProviderId: customServer.data.id,
              from: {
                type: 'remote',
                remoteUrl: nextRemoteUrl!,
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
                  customServer.data.id,
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
        }}
      >
        <Field field="name">
          {({ getFieldProps }) => <Input {...getFieldProps()} label="Name" />}
        </Field>

        <Field field="description">
          {({ getFieldProps }) => <Input {...getFieldProps()} label="Description" />}
        </Field>

        {isExternalProvider && (
          <>
            <Field field="remoteUrl">
              {({ getFieldProps }) => (
                <Input
                  {...getFieldProps()}
                  label="Remote URL"
                  description="Changing this URL publishes a new version for the external provider."
                />
              )}
            </Field>

            <Field field="remoteProtocol">
              {({ value, setValue }) => (
                <Select
                  value={String(value || '')}
                  label="MCP Transport Protocol"
                  description="Use the protocol supported by the remote MCP provider."
                  items={[
                    { label: 'SSE (Server-Sent Events)', id: 'sse' },
                    { label: 'Streamable HTTP', id: 'streamable_http' }
                  ]}
                  onChange={v => setValue(v)}
                />
              )}
            </Field>
          </>
        )}
      </FormBox>
    </FormPage>
  );
};
