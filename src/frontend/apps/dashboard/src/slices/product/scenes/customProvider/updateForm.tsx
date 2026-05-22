import { RiDeleteBinLine } from '@remixicon/react';
import { CustomProvidersGetOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCreateCustomProviderVersion,
  useCurrentInstance,
  useCustomProvider,
  useCustomProviderEnv
} from '@metorial/state';
import { Button, Group, Input, Select, Spacer, Text, theme, toast } from '@metorial/ui';
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

let EnvActions = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
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
  let createVersionMutator = useCreateCustomProviderVersion();
  let customProviderData = customProvider.data ?? p.customProvider;
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
  let isSaving = updateMutator.isLoading || createVersionMutator.isLoading;
  let isSaved = !isSaving && (updateMutator.isSuccess || createVersionMutator.isSuccess);
  let currentEnv = useMemo(
    () => normalizeEnvRecord(customProviderEnv.data?.env),
    [customProviderEnv.data?.env]
  );
  let initialEnvRows = useMemo(() => envRecordToRows(currentEnv), [currentEnv]);

  let form = useForm({
    initialValues: {
      name: customProviderData?.name ?? '',
      description: customProviderData?.description ?? '',
      remoteUrl: currentRemoteUrl,
      remoteProtocol: currentRemoteProtocol,
      envRows: initialEnvRows
    },
    updateInitialValues: true,
    onSubmit: async values => {
      if (!instance.data) return;
      if (!customProviderData) return;

      let nextRemoteUrl = values.remoteUrl.trim();
      let nextRemoteProtocol: 'sse' | 'streamable_http' =
        values.remoteProtocol == 'sse' ? 'sse' : 'streamable_http';
      let nextEnv = rowsToEnvRecord(values.envRows);
      let didUpdateRemote =
        isExternalProvider &&
        (nextRemoteUrl !== currentRemoteUrl || nextRemoteProtocol !== currentRemoteProtocol);
      let didUpdateEnv =
        isFunctionProvider && stringifyEnvRecord(nextEnv) !== stringifyEnvRecord(currentEnv);

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

      if (didUpdateEnv) {
        let [version] = await createVersionMutator.mutate({
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

      return isExternalProvider
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
              .required('Transport protocol is required'),
            envRows
          })
        : (yup.object({
            name: yup.string().trim().required('Name is required'),
            description: yup.string(),
            remoteUrl: yup.string().optional(),
            remoteProtocol: yup.mixed<CustomProviderRemoteProtocol>().optional(),
            envRows
          }) as any);
    }
  });

  let addEnvRow = () => {
    form.setFieldValue('envRows', [
      ...form.values.envRows,
      { id: `env-${Date.now()}`, key: '', value: '' }
    ]);
  };

  let updateEnvRow = (id: string, values: Partial<EnvVarRow>) => {
    form.setFieldValue(
      'envRows',
      form.values.envRows.map(row => (row.id === id ? { ...row, ...values } : row))
    );
  };

  let removeEnvRow = (id: string) => {
    form.setFieldValue(
      'envRows',
      form.values.envRows.filter(row => row.id !== id)
    );
  };

  return (
    <FormPage>
      <form onSubmit={form.handleSubmit}>
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
          </Group.Content>
        </Group.Wrapper>

        {isFunctionProvider && (
          <>
            <Spacer size={15} />

            <Group.Wrapper>
              <Group.Header
                title="Environment Variables"
                description="Set custom environment variables for your provider. Use configs and auth configs for sensitive and user-specific data."
              />

              <Group.Content>
                {customProviderEnv.isLoading ? (
                  <Text size="2" color="gray600">
                    Loading environment variables...
                  </Text>
                ) : (
                  <>
                    {form.values.envRows.length > 0 && (
                      <EnvRows>
                        {form.values.envRows.map((row, idx) => (
                          <EnvRow key={row.id}>
                            <Input
                              label="Name"
                              hideLabel={idx !== 0}
                              placeholder="DATABASE_URL"
                              value={row.key}
                              onChange={e => updateEnvRow(row.id, { key: e.target.value })}
                            />

                            <Input
                              label="Value"
                              hideLabel={idx !== 0}
                              placeholder="Enter value"
                              type="password"
                              value={row.value}
                              onChange={e => updateEnvRow(row.id, { value: e.target.value })}
                            />

                            <Button
                              variant="soft"
                              color="red"
                              type="button"
                              onClick={() => removeEnvRow(row.id)}
                              iconRight={<RiDeleteBinLine />}
                            />
                          </EnvRow>
                        ))}
                      </EnvRows>
                    )}

                    <EnvActions>
                      <Button size="2" variant="outline" type="button" onClick={addEnvRow}>
                        Add variable
                      </Button>
                    </EnvActions>
                  </>
                )}

                <form.RenderError field="envRows" />
                {customProviderEnv.error && (
                  <Text size="2" color="red600">
                    {customProviderEnv.error.message}
                  </Text>
                )}
              </Group.Content>
            </Group.Wrapper>
          </>
        )}

        <Spacer size={15} />

        <SaveActions>
          <Button size="2" type="submit" loading={isSaving} success={isSaved}>
            Save
          </Button>
        </SaveActions>

        {updateMutator.error && <updateMutator.RenderError />}
        {createVersionMutator.error && <createVersionMutator.RenderError />}
      </form>
    </FormPage>
  );
};
