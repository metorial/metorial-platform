import { CodeEditor } from '@metorial/code-editor';
import { CustomProvidersGetOutput } from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCreateCustomServerVersion,
  useCurrentInstance,
  useCustomServer,
  useCustomServerVersion,
  useCustomServerVersions
} from '@metorial/state';
import {
  Button,
  Callout,
  confirm,
  Group,
  Input,
  InputLabel,
  Select,
  Spacer,
  Switch,
  TextArrayInput,
  theme,
  toast
} from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { switcher } from '../../../../lib/switcher';
import { FormBox } from '../form/box';
import { Field } from '../form/field';
import { Form } from '../form/form';
import { FormPage } from '../form/page';
import { SchemaEditor } from '../jsonSchemaEditor';
import { parseConfig } from '../providerConnection/config';
import { showProviderConnectionFormModal } from '../providerConnection/modal';
import { defaultServerConfigManaged, defaultServerConfigRemote } from './config';

export let CustomServerUpdateForm = (p: { customServer?: CustomProvidersGetOutput }) => {
  let instance = useCurrentInstance();
  let customServer = useCustomServer(instance.data?.id, p.customServer?.id);

  let defaultServerConfig = defaultServerConfigManaged;

  let updateMutator = customServer.useUpdateMutator();
  let deleteMutator = customServer.useUpdateMutator();

  let createVersionMutatorSchema = useCreateCustomServerVersion();
  let createVersionMutatorOauth = useCreateCustomServerVersion();

  let currentVersion = useCustomServerVersion(
    instance.data?.id,
    p.customServer?.id,
    customServer.data?.provider?.currentVersion?.id ?? 'current'
  );
  let newVersionList = useCustomServerVersions(instance.data?.id, p.customServer?.id, {
    order: 'desc',
    limit: 1
  });
  let newVersion = newVersionList.data?.items?.[0];
  let isDeployingNewVersion =
    currentVersion.data?.id != newVersion?.id && newVersion?.status == 'deploying';

  let editingVersion = useRef(currentVersion.data);
  if (!editingVersion.current) editingVersion.current = currentVersion.data;

  let navigate = useNavigate();

  let providerOauth = null as { type: string; config?: unknown; scopes?: string[] } | null;

  return (
    <FormPage>
      {isDeployingNewVersion && (
        <Callout color="orange">
          Metorial is currently deploying a new version of this custom provider.
        </Callout>
      )}

      <FormBox
        title="General"
        description="Update the details of your custom provider."
        schema={yup =>
          yup.object({
            name: yup.string().optional(),
            description: yup.string().optional()
          })
        }
        initialValues={{
          name: customServer.data?.name ?? '',
          description: customServer.data?.description ?? ''
        }}
        mutators={[updateMutator]}
        onSubmit={async values => {
          if (!instance.data) return;

          await updateMutator.mutate({
            name: values.name || undefined,
            description: values.description || undefined
          });
        }}
      >
        <Field field="name">
          {({ getFieldProps }) => <Input {...getFieldProps()} label="Name" />}
        </Field>

        <Field field="description">
          {({ getFieldProps }) => <Input {...getFieldProps()} label="Description" />}
        </Field>
      </FormBox>

      {currentVersion.data && (
        <FormBox
          title="Remote Provider Configuration"
          description="Set up how Metorial connects to the remote provider."
          schema={yup =>
            yup.object({
              remoteUri: yup.string().optional(),
              remoteProtocol: yup.string().optional()
            })
          }
          initialValues={{
            remoteUri: '',
            remoteProtocol: 'sse'
          }}
          mutators={[updateMutator]}
          onSubmit={async values => {
            if (!instance.data || !p.customServer) return;

            let [res] = await createVersionMutatorSchema.mutate({
              instanceId: instance.data.id,
              customServerId: p.customServer.id,
              from: {
                type: 'remote',
                remoteUrl: values.remoteUri ?? '',
                protocol: (values.remoteProtocol ?? 'sse') as 'sse' | 'streamable_http'
              }
            });

            if (res) {
              toast.success('An updated version is currently being deployed.');
            }
          }}
        >
          <Field field="remoteUri">
            {({ getFieldProps }) => <Input {...getFieldProps()} label="Remote URL" />}
          </Field>

          <Field field="remoteProtocol">
            {({ value, setValue }) => (
              <Select
                value={value}
                label="MCP Transport Protocol"
                description="Which transport protocol does your MCP provider support?"
                items={[
                  { label: 'SSE (Server-Sent Events)', id: 'sse' },
                  { label: 'Streamable HTTP', id: 'streamable_http' }
                ]}
                onChange={v => setValue(v)}
              />
            )}
          </Field>
        </FormBox>
      )}

      {currentVersion.error?.data.status != 404 && (
        <Group.Wrapper>
          <Group.Header
            title="Provider Configuration Schema"
            description="Customize the configuration schema for deploying this custom provider."
          />

          {renderWithLoader({ currentVersion, customServer })(
            ({ currentVersion, customServer }) => (
              <Form
                schema={yup =>
                  yup.object({
                    schema: yup.object(),
                    getLaunchParams: yup.string().required('Launch parameters are required')
                  })
                }
                updateInitialValues
                initialValues={{
                  schema: defaultServerConfig.schema,
                  getLaunchParams: defaultServerConfig.getLaunchParams
                }}
                mutators={[createVersionMutatorSchema]}
                gap={0}
                actionsWrapper={({ children }) => (
                  <Group.Content style={{ borderTop: `1px solid ${theme.colors.gray300}` }}>
                    {children}
                  </Group.Content>
                )}
                onSubmit={async values => {
                  if (!instance.data || !p.customServer) return;

                  let [res] = await createVersionMutatorSchema.mutate({
                    instanceId: instance.data.id,
                    customServerId: p.customServer.id,
                    from: {
                      type: 'function',
                      files: [],
                      env: {},
                      runtime: { identifier: 'nodejs' as const, version: '22.x' as const }
                    },
                    config: {
                      schema: values.schema,
                      transformer: values.getLaunchParams
                    }
                  });

                  if (res) {
                    editingVersion.current = {
                      ...editingVersion.current,
                      ...res
                    } as typeof editingVersion.current;

                    toast.success('An updated version is currently being deployed.');
                  }
                }}
              >
                <Group.Row>
                  <Field field="schema">
                    {({ value, setValue }) => (
                      <SchemaEditor
                        title={customServer.data?.name || 'Custom Provider Schema'}
                        value={(value ?? defaultServerConfig.schema) as Record<string, unknown>}
                        onChange={v => setValue(v)}
                      />
                    )}
                  </Field>
                </Group.Row>

                <Group.Content style={{ borderTop: `1px solid ${theme.colors.gray300}` }}>
                  <Field field="getLaunchParams">
                    {({ value, setValue }) => (
                      <>
                        <CodeEditor
                          value={value}
                          onChange={v => setValue(v)}
                          label="Launch Parameters"
                          lang="javascript"
                          height="300px"
                        />
                      </>
                    )}
                  </Field>
                </Group.Content>
              </Form>
            )
          )}
        </Group.Wrapper>
      )}

      <FormBox
        title="OAuth Configuration"
        description="Configure how this custom provider connects to your OAuth service."
        schema={yup =>
          yup.object({
            enabled: yup.boolean(),

            scopes: yup.array(yup.string()).when('enabled', {
              is: true,
              then: schema => schema.required('At least one scope is required')
            }),
            config: yup.string().when('enabled', {
              is: true,
              then: schema =>
                schema
                  .required('Configuration is required')
                  .test('is-json', 'Configuration must be valid JSON', value => {
                    try {
                      parseConfig(value);
                      return true;
                    } catch {
                      return false;
                    }
                  })
            })
          })
        }
        initialValues={
          providerOauth?.type == 'json'
            ? {
                enabled: !!providerOauth?.config,
                scopes: providerOauth?.scopes ?? [],
                config: JSON.stringify(providerOauth?.config || {}, null, 2)
              }
            : {}
        }
        updateInitialValues
        mutators={[createVersionMutatorOauth]}
        actionsWrapper={() => null}
        onSubmit={async values => {
          if (!instance.data || !p.customServer || providerOauth?.type != 'json') return;

          let config: any = providerOauth?.config || {};
          if (values.config) {
            try {
              config = parseConfig(values.config);
            } catch (e) {
              return toast.error('Invalid configuration format. Please check your JSON.');
            }
          }

          let scopes = ((values.scopes as any[])?.filter(s => s && s.trim()) ??
            []) as string[];

          let [res] = await createVersionMutatorOauth.mutate({
            instanceId: instance.data.id,
            customServerId: p.customServer.id,
            from: {
              type: 'function',
              files: [],
              env: {},
              runtime: { identifier: 'nodejs' as const, version: '22.x' as const }
            }
          });

          if (res) {
            editingVersion.current = {
              ...editingVersion.current,
              ...res
            } as typeof editingVersion.current;

            toast.success('An updated version is currently being deployed.');
          }
        }}
      >
        {(form: any) =>
          providerOauth?.type == 'custom' ? (
            <Callout color="blue">
              This provider uses a custom OAuth service defined in the provider's code.
            </Callout>
          ) : (
            <>
              <Field field="enabled">
                {({ value, setValue }) => (
                  <Switch
                    label="Use OAuth to connect to the MCP provider."
                    checked={value}
                    onCheckedChange={v => {
                      if (v) {
                        showProviderConnectionFormModal({
                          onCreate: con => {
                            form.setFieldValue(
                              'scopes',
                              con.config.type == 'json' ? con.config.scopes : []
                            );
                            form.setFieldValue(
                              'config',
                              JSON.stringify(
                                con.config.type == 'json' ? con.config.config : {},
                                null,
                                2
                              )
                            );
                            form.setFieldValue('enabled', true);

                            setTimeout(() => {
                              form.submitForm();
                            }, 500);
                          }
                        });
                      } else {
                        setValue(false);
                      }
                    }}
                  />
                )}
              </Field>

              {form.values.enabled && (
                <>
                  <Field field="scopes">
                    {({ value, setValue }) => (
                      <TextArrayInput label="Scopes" value={value} onChange={setValue} />
                    )}
                  </Field>

                  <Field field="config">
                    {({ value, form }) => (
                      <>
                        <InputLabel>Configuration</InputLabel>
                        <Spacer size={6} />
                        <CodeEditor
                          value={value}
                          onChange={v => form.setFieldValue('config', v)}
                          onBlur={() => {
                            form.validateField('config');
                            form.setFieldTouched('config', true);
                          }}
                          lang="json"
                          height="350px"
                        />
                      </>
                    )}
                  </Field>
                </>
              )}
            </>
          )
        }
      </FormBox>

      <Box
        title="Delete Custom Provider"
        description="Delete this custom provider. This action cannot be undone."
      >
        <Button
          color="red"
          onClick={() =>
            confirm({
              title: 'Delete Custom Provider',
              description:
                'Are you sure you want to delete this custom provider? This action cannot be undone.',
              onConfirm: async () => {
                if (!instance.data) return;

                let [res] = await deleteMutator.mutate({});
                if (res) {
                  toast.success('Custom provider deleted successfully.');
                  navigate(
                    p.customServer?.status == 'active'
                      ? Paths.instance.externalServers(
                          instance.data?.organization,
                          instance.data?.project,
                          instance.data
                        )
                      : Paths.instance.managedServers(
                          instance.data?.organization,
                          instance.data?.project,
                          instance.data
                        )
                  );
                }
              }
            })
          }
          disabled={customServer.data?.status === 'archived'}
        >
          Delete
        </Button>
      </Box>
    </FormPage>
  );
};
