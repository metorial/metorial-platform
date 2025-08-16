import { CodeEditor } from '@metorial/code-editor';
import { CustomServersGetOutput } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useCustomServer } from '@metorial/state';
import {
  Button,
  confirm,
  Input,
  InputLabel,
  Spacer,
  Switch,
  TextArrayInput,
  toast
} from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNavigate } from 'react-router-dom';
import { FormBox } from '../form/box';
import { Field } from '../form/field';
import { FormPage } from '../form/page';
import { parseConfig } from '../providerConnection/config';

let emptyClientSecret = '••••••••••••••••••••••••••••••';

export let CustomServerUpdateForm = (p: { customServer?: CustomServersGetOutput }) => {
  let instance = useCurrentInstance();
  let customServer = useCustomServer(instance.data?.id, p.customServer?.id);

  let updateMutator = customServer.useUpdateMutator();
  let deleteMutator = customServer.useDeleteMutator();

  let navigate = useNavigate();

  return (
    <FormPage>
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

      <FormBox
        title="Server Configuration Schema"
        description="Customize the configuration schema for deploying this custom server."
        schema={yup => yup.object({})}
        initialValues={{}}
        mutators={[updateMutator]}
        onSubmit={async values => {
          if (!instance.data) return;

          // await updateMutator.mutate({
          //   name: values.name || undefined,
          //   description: values.description || undefined
          // });
        }}
      >
        <Field field="name">
          {({ getFieldProps }) => <Input {...getFieldProps()} label="Name" />}
        </Field>

        <Field field="description">
          {({ getFieldProps }) => <Input {...getFieldProps()} label="Description" />}
        </Field>
      </FormBox>

      <FormBox
        title="OAuth Configuration"
        description="Configure how this custom server connects to your OAuth provider."
        schema={yup =>
          yup.object({
            scopes: yup.array(yup.string()).required('Scopes are required'),
            config: yup
              .string()
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
        }
        initialValues={{
          // scopes: customServer.data?.scopes ?? [],
          // config: JSON.stringify(customServer.data?.config ?? {}, null, 2)

          scopes: [],
          config: ''
        }}
        mutators={[updateMutator]}
        onSubmit={async values => {
          if (!instance.data) return;

          let config: any = {};
          try {
            config = parseConfig(values.config);
          } catch (e) {
            return toast.error('Invalid configuration format. Please check your JSON.');
          }

          // await updateMutator.mutate({
          //   scopes: values.scopes.filter(s => s && s.trim()) as string[],
          //   config
          // });
        }}
      >
        <Field field="scopes">
          {({ value, setValue }) => <Switch label="Use OAuth to connect to the MCP server." />}
        </Field>

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
