import { CodeEditor } from '@metorial/code-editor';
import { ProviderOauthConnectionsGetOutput } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useProviderConnection } from '@metorial/state';
import {
  Button,
  confirm,
  Input,
  InputLabel,
  Spacer,
  TextArrayInput,
  toast
} from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNavigate } from 'react-router-dom';
import { FormBox } from '../form/box';
import { Field } from '../form/field';
import { FormPage } from '../form/page';
import { parseConfig } from './config';

let emptyClientSecret = '••••••••••••••••••••••••••••••';

export let ProviderConnectionUpdateForm = (p: {
  providerConnection?: ProviderOauthConnectionsGetOutput;
}) => {
  let instance = useCurrentInstance();
  let providerConnection = useProviderConnection(instance.data?.id, p.providerConnection?.id);

  let updateMutator = providerConnection.useUpdateMutator();
  let deleteMutator = providerConnection.useDeleteMutator();

  let navigate = useNavigate();

  return (
    <FormPage>
      <FormBox
        title="General"
        description="Update the details of your OAuth connection."
        schema={yup =>
          yup.object({
            name: yup.string().optional(),
            description: yup.string().optional()
          })
        }
        initialValues={{
          name: providerConnection.data?.name ?? '',
          description: providerConnection.data?.description ?? ''
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
        title="OAuth Configuration"
        description="Update the OAuth configuration details."
        schema={yup =>
          yup.object({
            clientId: yup.string().required('Client ID is required'),
            clientSecret: yup.string().required('Client ID is required'),
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
          clientId: providerConnection.data?.clientId ?? '',
          clientSecret: emptyClientSecret,
          scopes: providerConnection.data?.scopes ?? [],
          config: JSON.stringify(providerConnection.data?.config ?? {}, null, 2)
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

          await updateMutator.mutate({
            clientId: values.clientId || undefined,
            clientSecret:
              values.clientSecret == emptyClientSecret
                ? undefined
                : values.clientSecret || undefined,
            scopes: values.scopes.filter(s => s && s.trim()) as string[],
            config
          });
        }}
      >
        <Field field="clientId">
          {({ getFieldProps }) => <Input {...getFieldProps()} label="Client ID" />}
        </Field>

        <Field field="clientSecret">
          {({ getFieldProps }) => (
            <Input
              {...getFieldProps()}
              label="Client Secret"
              type="password"
              placeholder={emptyClientSecret}
            />
          )}
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
        title="Delete Connection"
        description="Delete this OAuth connection. This action cannot be undone."
      >
        <Button
          color="red"
          onClick={() =>
            confirm({
              title: 'Delete OAuth Connection',
              description:
                'Are you sure you want to delete this OAuth connection? This action cannot be undone.',
              onConfirm: async () => {
                if (!instance.data) return;

                let [res] = await deleteMutator.mutate({});
                if (res) {
                  toast.success('OAuth connection deleted successfully.');
                  navigate(
                    Paths.instance.providerConnections(
                      instance.data?.organization,
                      instance.data?.project,
                      instance.data
                    )
                  );
                }
              }
            })
          }
          disabled={providerConnection.data?.status === 'archived'}
        >
          Delete
        </Button>
      </Box>
    </FormPage>
  );
};
