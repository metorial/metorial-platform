import { CustomProvidersGetOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCreateCustomProviderVersion,
  useCurrentInstance,
  useCustomProvider,
  useCustomProviderEnv
} from '@metorial/state';
import { Button, Group, Input, Select, Spacer, Text, toast } from '@metorial/ui';
import { RiDeleteBinLine } from '@remixicon/react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { FormPage } from '../form/page';
import {
  type CustomProviderRemoteProtocol,
  getCustomProviderRemoteProtocolFromUrl,
  getFunctionProviderVersionFrom,
  normalizeEnvRecord
} from './utils';

type EnvVarRow = {
  id: string;
  key: string;
  value: string;
};

let EnvRows = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: 12px;
  gap: 10px;
`;

let EnvRow = styled.div`
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(220px, 1.2fr) auto;
  gap: 12px;
  align-items: end;
`;

let SaveActions = styled.div`
  display: flex;
  justify-content: flex-end;
`;

let envRecordToRows = (env: Record<string, string>): EnvVarRow[] =>
  Object.entries(env).map(([key, value]) => ({
    id: `env-${key}`,
    key,
    value
  }));

let rowsToEnvRecord = (rows: EnvVarRow[]) => {
  let env: Record<string, string> = {};

  for (let row of rows) {
    let key = row.key.trim();
    if (!key) continue;
    env[key] = String(row.value ?? '');
  }

  return env;
};

let stringifyEnvRecord = (env: Record<string, string>) =>
  JSON.stringify(
    Object.keys(env)
      .sort()
      .reduce<Record<string, string>>((acc, key) => {
        acc[key] = env[key];
        return acc;
      }, {})
  );

export let CustomProviderUpdateForm = (p: { customProvider?: CustomProvidersGetOutput }) => {
  let instance = useCurrentInstance();
  let customProvider = useCustomProvider(instance.data?.id, p.customProvider?.id);
  let navigate = useNavigate();
  let updateMutator = customProvider.useUpdateMutator();
  let remoteVersionMutator = useCreateCustomProviderVersion();
  let envVersionMutator = useCreateCustomProviderVersion();
  let customProviderData = customProvider.data ?? p.customProvider;
  let isArchived = customProviderData?.status === 'archived';
  let isFunctionProvider = customProviderData?.type === 'function';
  let customProviderEnv = useCustomProviderEnv(
    isFunctionProvider ? instance.data?.id : null,
    isFunctionProvider ? customProviderData?.id : null
  );
  let isExternalProvider = Boolean(customProviderData?.draft?.remoteMcpServer);
  let currentRemoteUrl = customProviderData?.draft?.remoteMcpServer?.url ?? '';
  let currentRemoteProtocol =
    customProviderData?.draft?.remoteMcpServer?.transport ??
    getCustomProviderRemoteProtocolFromUrl(currentRemoteUrl);
  let currentEnv = useMemo(
    () => normalizeEnvRecord(customProviderEnv.data?.env),
    [customProviderEnv.data?.env]
  );
  let initialEnvRows = useMemo(() => envRecordToRows(currentEnv), [currentEnv]);

  let generalForm = useForm({
    initialValues: {
      name: customProviderData?.name ?? '',
      description: customProviderData?.description ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      if (!instance.data) return;
      if (!customProviderData) return;
      if (isArchived) return;

      await updateMutator.mutate({
        name: values.name.trim(),
        description: values.description.trim() || undefined
      });
      await customProvider.refetch();
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string()
      })
  });

  let remoteForm = useForm({
    initialValues: {
      remoteUrl: currentRemoteUrl,
      remoteProtocol: currentRemoteProtocol
    },
    updateInitialValues: true,
    onSubmit: async values => {
      if (!instance.data) return;
      if (!customProviderData) return;
      if (isArchived) return;
      if (!isExternalProvider) return;

      let nextRemoteUrl = values.remoteUrl.trim();
      let nextRemoteProtocol: 'sse' | 'streamable_http' =
        values.remoteProtocol == 'sse' ? 'sse' : 'streamable_http';
      let didUpdateRemote =
        nextRemoteUrl !== currentRemoteUrl || nextRemoteProtocol !== currentRemoteProtocol;
      if (!didUpdateRemote) return;

      let [version] = await remoteVersionMutator.mutate({
        instanceId: instance.data.id,
        customProviderId: customProviderData.id,
        from: {
          type: 'remote',
          remoteUrl: nextRemoteUrl,
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
    },
    schema: yup =>
      yup.object({
        remoteUrl: yup
          .string()
          .trim()
          .url('Remote URL must be a valid URL')
          .required('Remote URL is required'),
        remoteProtocol: yup
          .mixed<CustomProviderRemoteProtocol>()
          .oneOf(['sse', 'streamable_http'])
          .required('Transport protocol is required')
      })
  });

  let envForm = useForm({
    initialValues: {
      envRows: initialEnvRows
    },
    updateInitialValues: true,
    onSubmit: async values => {
      if (!instance.data) return;
      if (!customProviderData) return;
      if (isArchived) return;
      if (!isFunctionProvider) return;

      let nextEnv = rowsToEnvRecord(values.envRows);
      let didUpdateEnv = stringifyEnvRecord(nextEnv) !== stringifyEnvRecord(currentEnv);
      if (!didUpdateEnv) return;

      let [version] = await envVersionMutator.mutate({
        instanceId: instance.data.id,
        customProviderId: customProviderData.id,
        from: getFunctionProviderVersionFrom(customProviderData, nextEnv)
      });

      if (version) {
        toast.success('Environment variable update started');
        await customProvider.refetch();
        await customProviderEnv.refetch();

        navigate(
          Paths.instance.customProvider(
            instance.data.organization,
            instance.data.project,
            instance.data,
            customProviderData.id,
            'versions',
            { version_id: version.id }
          )
        );
      }
    },
    schema: yup => {
      let envRows = yup
        .array()
        .of(
          yup.object({
            id: yup.string().required(),
            key: yup.string(),
            value: yup.string()
          })
        )
        .test('env-keys', 'Environment variables need unique names.', rows => {
          let keys = (rows ?? []).map(row => row.key?.trim()).filter(Boolean);
          return keys.length === new Set(keys).size;
        })
        .test('env-key-required', 'Add a variable name or remove the empty row.', rows => {
          return (rows ?? []).every(row => row.key?.trim() || !row.value);
        });

      return yup.object({ envRows });
    }
  });

  let addEnvRow = () => {
    envForm.setFieldValue('envRows', [
      ...envForm.values.envRows,
      { id: `env-${Date.now()}`, key: '', value: '' }
    ]);
  };

  let updateEnvRow = (id: string, values: Partial<EnvVarRow>) => {
    envForm.setFieldValue(
      'envRows',
      envForm.values.envRows.map(row => (row.id === id ? { ...row, ...values } : row))
    );
  };

  let removeEnvRow = (id: string) => {
    envForm.setFieldValue(
      'envRows',
      envForm.values.envRows.filter(row => row.id !== id)
    );
  };

  return (
    <FormPage>
      <form onSubmit={generalForm.handleSubmit}>
        <Group.Wrapper>
          <Group.Header
            title="General"
            description={
              isExternalProvider
                ? 'Update the display details of your external provider.'
                : 'Update the details of your custom provider.'
            }
          />

          <Group.Content>
            <Input label="Name" disabled={isArchived} {...generalForm.getFieldProps('name')} />
            <generalForm.RenderError field="name" />

            <Spacer size={15} />

            <Input
              label="Description"
              disabled={isArchived}
              {...generalForm.getFieldProps('description')}
            />
            <generalForm.RenderError field="description" />

            <Spacer size={15} />

            <SaveActions>
              <Button
                size="2"
                type="submit"
                loading={updateMutator.isLoading}
                success={updateMutator.isSuccess}
                disabled={isArchived}
              >
                Save
              </Button>
            </SaveActions>

            {updateMutator.error && <updateMutator.RenderError />}
          </Group.Content>
        </Group.Wrapper>
      </form>

      {isExternalProvider && (
        <>
          <form onSubmit={remoteForm.handleSubmit}>
            <Group.Wrapper>
              <Group.Header
                title="Remote Provider"
                description="Update the remote MCP endpoint. Changes publish a new provider version."
              />

              <Group.Content>
                <Input
                  label="Remote URL"
                  description="Changing this URL publishes a new version for the external provider."
                  disabled={isArchived}
                  {...remoteForm.getFieldProps('remoteUrl')}
                />
                <remoteForm.RenderError field="remoteUrl" />

                <Spacer size={15} />

                <Select
                  value={String(remoteForm.values.remoteProtocol || '')}
                  label="MCP Transport Protocol"
                  description="Use the protocol supported by the remote MCP provider."
                  disabled={isArchived}
                  items={[
                    { label: 'SSE (Server-Sent Events)', id: 'sse' },
                    { label: 'Streamable HTTP', id: 'streamable_http' }
                  ]}
                  onChange={v => remoteForm.setFieldValue('remoteProtocol', v)}
                />
                <remoteForm.RenderError field="remoteProtocol" />

                <Spacer size={15} />

                <SaveActions>
                  <Button
                    size="2"
                    type="submit"
                    loading={remoteVersionMutator.isLoading}
                    success={remoteVersionMutator.isSuccess}
                    disabled={isArchived}
                  >
                    Save
                  </Button>
                </SaveActions>

                {remoteVersionMutator.error && <remoteVersionMutator.RenderError />}
              </Group.Content>
            </Group.Wrapper>
          </form>
        </>
      )}

      {isFunctionProvider && (
        <>
          <form onSubmit={envForm.handleSubmit}>
            <Group.Wrapper>
              <Group.Header
                title="Environment Variables"
                description="Set custom environment variables for your provider. Use configs and auth configs for sensitive and user-specific data."
                actions={
                  <Button
                    size="2"
                    variant="outline"
                    type="button"
                    disabled={isArchived}
                    onClick={addEnvRow}
                  >
                    Add Variable
                  </Button>
                }
              />

              <Group.Content>
                {customProviderEnv.isLoading ? (
                  <Text size="2" color="gray600">
                    Loading environment variables...
                  </Text>
                ) : (
                  <>
                    {envForm.values.envRows.length > 0 && (
                      <EnvRows>
                        {envForm.values.envRows.map((row, idx) => (
                          <EnvRow key={row.id}>
                            <Input
                              label="Name"
                              hideLabel={idx !== 0}
                              placeholder="DATABASE_URL"
                              disabled={isArchived}
                              value={row.key}
                              onChange={e => updateEnvRow(row.id, { key: e.target.value })}
                            />

                            <Input
                              label="Value"
                              hideLabel={idx !== 0}
                              placeholder="Enter value"
                              type="password"
                              disabled={isArchived}
                              value={row.value}
                              onChange={e => updateEnvRow(row.id, { value: e.target.value })}
                            />

                            <Button
                              variant="soft"
                              color="red"
                              type="button"
                              disabled={isArchived}
                              onClick={() => removeEnvRow(row.id)}
                              iconRight={<RiDeleteBinLine />}
                            />
                          </EnvRow>
                        ))}
                      </EnvRows>
                    )}

                    {envForm.values.envRows.length === 0 && (
                      <Text size="2" color="gray600">
                        No environment variables configured.
                      </Text>
                    )}
                  </>
                )}

                <envForm.RenderError field="envRows" />
                {customProviderEnv.error && (
                  <Text size="2" color="red600">
                    {customProviderEnv.error.message}
                  </Text>
                )}

                <Spacer size={15} />

                <SaveActions>
                  <Button
                    size="2"
                    type="submit"
                    loading={envVersionMutator.isLoading}
                    success={envVersionMutator.isSuccess}
                    disabled={isArchived || customProviderEnv.isLoading}
                  >
                    Save
                  </Button>
                </SaveActions>

                {envVersionMutator.error && <envVersionMutator.RenderError />}
              </Group.Content>
            </Group.Wrapper>
          </form>
        </>
      )}
    </FormPage>
  );
};
