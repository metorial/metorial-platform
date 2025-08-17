import { CodeEditor } from '@metorial/code-editor';
import { CustomServersGetOutput } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
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
  Spacer,
  Switch,
  TextArrayInput,
  theme,
  toast
} from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormBox } from '../form/box';
import { Field } from '../form/field';
import { Form } from '../form/form';
import { FormPage } from '../form/page';
import { SchemaEditor } from '../jsonSchemaEditor';
import { parseConfig } from '../providerConnection/config';
import { defaultServerConfig } from './config';

export let CustomServerUpdateForm = (p: { customServer?: CustomServersGetOutput }) => {
  let instance = useCurrentInstance();
  let customServer = useCustomServer(instance.data?.id, p.customServer?.id);

  let updateMutator = customServer.useUpdateMutator();
  let deleteMutator = customServer.useDeleteMutator();

  let createVersionMutator = useCreateCustomServerVersion();

  let currentVersion = useCustomServerVersion(
    instance.data?.id,
    p.customServer?.id,
    customServer.data?.currentVersionId ?? 'current'
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

  return (
    <FormPage>
      {isDeployingNewVersion && (
        <Callout color="orange">
          Metorial is currently deploying a new version of this custom server.
        </Callout>
      )}

      <FormBox
        title="General"
        description="Update the details of your custom server."
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

      <Group.Wrapper>
        <Group.Header
          title="Server Configuration Schema"
          description="Customize the configuration schema for deploying this custom server."
        />

        {renderWithLoader({ currentVersion })(({ currentVersion }) => (
          <Form
            schema={yup =>
              yup.object({
                schema: yup.object(),
                getLaunchParams: yup.string().required('Launch parameters are required')
              })
            }
            updateInitialValues
            initialValues={{
              schema:
                editingVersion.current?.serverVersion?.schema.schema ??
                defaultServerConfig.schema,
              getLaunchParams:
                editingVersion.current?.serverVersion?.getLaunchParams ||
                defaultServerConfig.getLaunchParams
            }}
            mutators={[createVersionMutator]}
            gap={0}
            actionsWrapper={({ children }) => (
              <Group.Content style={{ borderTop: `1px solid ${theme.colors.gray300}` }}>
                {children}
              </Group.Content>
            )}
            onSubmit={async values => {
              if (!instance.data || !p.customServer) return;

              let [res] = await createVersionMutator.mutate({
                instanceId: instance.data.id,
                customServerId: p.customServer.id,
                implementation: {
                  type: 'remote',
                  config: {
                    schema: values.schema,
                    getLaunchParams: values.getLaunchParams
                  },
                  remoteServer: {
                    remoteUrl:
                      editingVersion.current?.serverInstance.remoteServer?.remoteUrl ?? '',
                    oauthConfig: editingVersion.current?.serverInstance.remoteServer
                      ?.providerOauth.config
                      ? {
                          scopes:
                            editingVersion.current?.serverInstance.remoteServer?.providerOauth
                              .scopes ?? [],
                          config:
                            editingVersion.current?.serverInstance.remoteServer?.providerOauth
                              .config
                        }
                      : undefined
                  }
                }
              });

              if (res) {
                editingVersion.current = {
                  ...editingVersion.current,
                  ...res,
                  serverVersion: res.serverVersion ?? editingVersion.current?.serverVersion
                } as any;

                toast.success('An updated version is currently being deployed.');
              }
            }}
          >
            <Group.Row>
              <Field field="schema">
                {({ value, setValue }) => (
                  <SchemaEditor
                    title={customServer.data?.name || 'Custom Server Schema'}
                    value={
                      (editingVersion.current?.serverVersion?.schema.schema ??
                        defaultServerConfig.schema) as any
                    }
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
        ))}
      </Group.Wrapper>

      <FormBox
        title="OAuth Configuration"
        description="Configure how this custom server connects to your OAuth provider."
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
        initialValues={{
          enabled: !!editingVersion.current?.serverInstance.remoteServer?.providerOauth.config,

          scopes:
            editingVersion.current?.serverInstance.remoteServer?.providerOauth.scopes ?? [],
          config: JSON.stringify(
            editingVersion.current?.serverInstance.remoteServer?.providerOauth.config || {},
            null,
            2
          )
        }}
        updateInitialValues
        mutators={[createVersionMutator]}
        onSubmit={async values => {
          if (!instance.data || !p.customServer) return;

          let config: any =
            editingVersion.current?.serverInstance.remoteServer?.providerOauth.config || {};
          if (values.config) {
            try {
              config = parseConfig(values.config);
            } catch (e) {
              return toast.error('Invalid configuration format. Please check your JSON.');
            }
          }

          let scopes = (values.scopes?.filter(s => s && s.trim()) ?? []) as string[];

          let [res] = await createVersionMutator.mutate({
            instanceId: instance.data.id,
            customServerId: p.customServer.id,
            implementation: {
              type: 'remote',
              config: {
                schema:
                  editingVersion.current?.serverVersion?.schema.schema ??
                  defaultServerConfig.schema,
                getLaunchParams:
                  editingVersion.current?.serverVersion?.getLaunchParams ??
                  defaultServerConfig.getLaunchParams
              },
              remoteServer: {
                remoteUrl:
                  editingVersion.current?.serverInstance.remoteServer?.remoteUrl ?? '',
                oauthConfig: values.enabled ? { scopes, config } : undefined
              }
            }
          });

          if (res) {
            editingVersion.current = {
              ...editingVersion.current,
              ...res,
              serverVersion: res.serverVersion ?? editingVersion.current?.serverVersion
            } as any;

            toast.success('An updated version is currently being deployed.');
          }
        }}
      >
        {(form: any) => (
          <>
            <Field field="enabled">
              {({ value, setValue }) => (
                <Switch
                  label="Use OAuth to connect to the MCP server."
                  checked={value}
                  onCheckedChange={setValue}
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
        )}
      </FormBox>

      <Box
        title="Delete Custom Server"
        description="Delete this custom server. This action cannot be undone."
      >
        <Button
          color="red"
          onClick={() =>
            confirm({
              title: 'Delete Custom Server',
              description:
                'Are you sure you want to delete this custom server? This action cannot be undone.',
              onConfirm: async () => {
                if (!instance.data) return;

                let [res] = await deleteMutator.mutate({});
                if (res) {
                  toast.success('Custom server deleted successfully.');
                  navigate(
                    p.customServer?.type == 'remote'
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
