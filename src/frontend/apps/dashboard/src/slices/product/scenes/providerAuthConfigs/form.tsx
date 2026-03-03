import {
  DashboardInstanceProviderDeploymentsAuthConfigsCreateOutput,
  DashboardInstanceProvidersAuthMethodsListOutput
} from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useCreateProviderAuthConfig,
  useProvider,
  useProviderAuthMethods,
  useProviderDeployment
} from '@metorial/state';
import { Button, CenteredSpinner, Dialog, Input, Select, Spacer, Text } from '@metorial/ui';
import { JSONSchema7 } from 'json-schema';
import { useEffect, useState } from 'react';
import { getJsonSchema, JsonSchemaEnvelope } from '../../lib/jsonSchema';
import { JsonSchemaInput } from '../jsonSchemaInput';
import { Stepper } from '../stepper';

type AuthMethod = DashboardInstanceProvidersAuthMethodsListOutput['items'][number];

export type ProviderAuthConfigFormProps =
  | { type: 'create'; providerDeploymentId: string; instanceId?: string }
  | {
      type: 'update';
      providerDeploymentId: string;
      authConfigId: string;
      instanceId?: string;
    };

export let ProviderAuthConfigForm = (
  props: ProviderAuthConfigFormProps & {
    close?: () => void;
    onCreate?: (authConfig: DashboardInstanceProviderDeploymentsAuthConfigsCreateOutput) => void;
    onBack?: () => void;
  }
) => {
  let instance = useCurrentInstance();
  let instanceId = props.instanceId ?? instance.data?.id;
  let createMutation = useCreateProviderAuthConfig();

  let deployment = useProviderDeployment(instanceId, props.providerDeploymentId);
  let provider = useProvider(instanceId, deployment.data?.providerId);
  let effectiveVersionId =
    deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id;
  let oauthAutoRegistrationEnabled =
    provider.data?.oauth?.autoRegistration?.status === 'enabled';

  let authMethods = useProviderAuthMethods(instanceId, effectiveVersionId);

  let [credentialsData, setCredentialsData] = useState<Record<string, unknown>>({});
  let [step, setStep] = useState(0);

  let form = useForm({
    initialValues: {
      name: '',
      description: '',
      authMethodId: '',
      credentialsDataJson: '{}'
    },
    onSubmit: async () => {},
    schemaDependencies: [authMethods.data?.items, oauthAutoRegistrationEnabled],
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required'),
        description: yup.string().defined(),
        authMethodId: yup.string().required('Authentication method is required'),
        credentialsDataJson: yup
          .string()
          .defined()
          .test('valid-json', 'Credentials data must be valid JSON', function (value) {
            let authMethodId = this.parent.authMethodId;
            let selectedMethod = authMethods.data?.items?.find(
              (method: AuthMethod) => method.id === authMethodId
            ) as AuthMethod | undefined;

            let schemaObj = getJsonSchema(
              selectedMethod?.inputSchema as
                | JsonSchemaEnvelope
                | Record<string, unknown>
                | null
                | undefined
            );
            let hasSchema =
              schemaObj &&
              typeof schemaObj === 'object' &&
              schemaObj.type === 'object' &&
              schemaObj.properties &&
              Object.keys(schemaObj.properties).length > 0;
            let isOAuthWithoutSchema =
              !!authMethodId &&
              selectedMethod?.type === 'oauth' &&
              !hasSchema &&
              oauthAutoRegistrationEnabled;

            if (!authMethodId || hasSchema || isOAuthWithoutSchema) return true;

            try {
              JSON.parse(value ?? '{}');
              return true;
            } catch {
              return false;
            }
          })
      })
  });

  let handleSubmit = async () => {
    let name = form.values.name.trim();

    form.setFieldTouched('authMethodId', true, false);
    await form.validateField('authMethodId');

    if (!form.values.authMethodId) return;

    if (!name) {
      form.setFieldTouched('name', true);
      form.setFieldError('name', 'Name is required');
      return;
    }

    form.setFieldError('name', undefined);

    let parsedCredentials: Record<string, unknown> = {};
    if (hasSchema) {
      parsedCredentials = credentialsData;
    } else if (isOAuthWithoutSchema) {
      parsedCredentials = {};
    } else {
      form.setFieldTouched('credentialsDataJson', true, false);
      await form.validateField('credentialsDataJson');

      try {
        parsedCredentials = JSON.parse(form.values.credentialsDataJson);
      } catch {
        form.setFieldError('credentialsDataJson', 'Credentials data must be valid JSON');
        return;
      }
    }

    if (props.type !== 'create' || !instanceId) return;

    let [result] = await createMutation.mutate({
      instanceId,
      providerDeploymentId: props.providerDeploymentId,
      name,
      description: form.values.description || undefined,
      providerAuthMethodId: form.values.authMethodId,
      value: parsedCredentials
    });

    if (!result) return;

    props.onCreate?.(result);
    props.close?.();
  };

  let selectedMethod = authMethods.data?.items?.find(
    (method: AuthMethod) => method.id === form.values.authMethodId
  ) as AuthMethod | undefined;

  let schemaObj = getJsonSchema(
    selectedMethod?.inputSchema as
      | JsonSchemaEnvelope
      | Record<string, unknown>
      | null
      | undefined
  );
  let hasSchema =
    schemaObj &&
    typeof schemaObj === 'object' &&
    schemaObj.type === 'object' &&
    schemaObj.properties &&
    Object.keys(schemaObj.properties).length > 0;
  let isOAuthWithoutSchema =
    !!form.values.authMethodId &&
    selectedMethod?.type === 'oauth' &&
    !hasSchema &&
    oauthAutoRegistrationEnabled;

  if (deployment.isLoading || authMethods.isLoading) {
    return <CenteredSpinner />;
  }

  let authMethodItems = (authMethods.data?.items ?? []).map((method: AuthMethod) => ({
    id: method.id,
    label: `${method.name} (${method.type})`
  }));
  let hasAuthMethods = authMethodItems.length > 0;
  let hasSingleMethod = authMethodItems.length === 1;
  let singleMethodId = authMethods.data?.items?.[0]?.id ?? '';

  useEffect(() => {
    if (!form.values.authMethodId && hasSingleMethod && singleMethodId) {
      form.setFieldValue('authMethodId', singleMethodId);
    }
  }, [form.values.authMethodId, hasSingleMethod, singleMethodId]);

  let resetCredentials = () => {
    setCredentialsData({});
    form.setFieldValue('credentialsDataJson', '{}');
    form.setFieldTouched('credentialsDataJson', false, false);
    form.setFieldError('credentialsDataJson', undefined);
  };

  let handleAuthMethodChange = (value: string) => {
    form.setFieldValue('authMethodId', value);
    resetCredentials();
  };

  let credentialsSection = hasSchema ? (
    <JsonSchemaInput
      schema={schemaObj as JSONSchema7}
      value={credentialsData}
      onChange={setCredentialsData}
      label="Credentials"
    />
  ) : isOAuthWithoutSchema ? (
    <Text size="2" color="gray600">
      This OAuth method is configured through the automated OAuth setup flow. Use the
      &quot;Configure&quot; action on a deployment to connect via OAuth, or provide raw
      credentials below.
    </Text>
  ) : (
    <>
      <Input
        label="Credentials Data (JSON)"
        as="textarea"
        minRows={5}
        style={{ fontFamily: 'monospace' }}
        {...form.getFieldProps('credentialsDataJson')}
      />
      <form.RenderError field="credentialsDataJson" />
    </>
  );

  if (props.type === 'create') {
    let credentialsStepIndex = hasSingleMethod ? 0 : 1;
    let detailsStepIndex = hasSingleMethod ? 1 : 2;

    let goToCredentialsStep = async () => {
      form.setFieldTouched('authMethodId', true, false);
      await form.validateField('authMethodId');

      if (!form.values.authMethodId) return;

      setStep(credentialsStepIndex);
    };

    let goToDetailsStep = async () => {
      if (!hasSchema && !isOAuthWithoutSchema) {
        form.setFieldTouched('credentialsDataJson', true, false);
        await form.validateField('credentialsDataJson');

        try {
          JSON.parse(form.values.credentialsDataJson);
        } catch {
          return;
        }
      }

      setStep(detailsStepIndex);
    };

    let methodStep = {
      title: 'Authentication',
      subtitle: 'Select auth method',
      render: () => (
        <>
          {hasAuthMethods ? (
            <Select
              label="Authentication Method"
              value={form.values.authMethodId}
              placeholder="Select an authentication method..."
              onChange={handleAuthMethodChange}
              items={authMethodItems}
            />
          ) : (
            <Text size="2" color="gray600">
              No auth methods found for this provider.
            </Text>
          )}
          <form.RenderError field="authMethodId" />

          {selectedMethod?.description && (
            <>
              <Spacer size={5} />
              <Text size="1" color="gray600">
                {selectedMethod.description}
              </Text>
            </>
          )}

          <Spacer size={10} />

          <Dialog.Actions>
            {hasAuthMethods ? (
              <>
                <Button variant="outline" onClick={props.close}>
                  Cancel
                </Button>
                <Button onClick={goToCredentialsStep} disabled={!form.values.authMethodId}>
                  Continue
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={props.onBack ?? props.close}>
                Back
              </Button>
            )}
          </Dialog.Actions>
        </>
      )
    };

    let credentialsStep = {
      title: 'Credentials',
      subtitle: 'Provide credential values',
      render: () => (
        <>
          {selectedMethod && (
            <Text size="1" color="gray600">
              Configuring <strong>{selectedMethod.name}</strong> ({selectedMethod.type})
            </Text>
          )}

          <Spacer size={10} />

          {credentialsSection}

          <Spacer size={15} />

          <Dialog.Actions>
            {!hasSingleMethod && (
              <Button variant="outline" onClick={() => setStep(0)}>
                Back
              </Button>
            )}
            {hasSingleMethod && (
              <Button variant="outline" onClick={props.close}>
                Cancel
              </Button>
            )}
            <Button onClick={goToDetailsStep}>Continue</Button>
          </Dialog.Actions>
        </>
      )
    };

    let detailsStep = {
      title: 'Details',
      subtitle: 'Name and create',
      render: () => (
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <Input label="Name" required {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={10} />

          <Input label="Description" {...form.getFieldProps('description')} />

          <Spacer size={15} />

          <Dialog.Actions>
            <Button variant="outline" onClick={() => setStep(credentialsStepIndex)}>
              Back
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              loading={createMutation.isPending}
              disabled={!form.values.authMethodId}
            >
              Create
            </Button>
          </Dialog.Actions>

          <createMutation.RenderError />
        </form>
      )
    };

    let steps = hasSingleMethod
      ? [credentialsStep, detailsStep]
      : [methodStep, credentialsStep, detailsStep];

    return (
      <Stepper
        steps={steps}
        currentStep={step}
        setCurrentStep={setStep}
      />
    );
  }

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <Input label="Name" required {...form.getFieldProps('name')} />
      <form.RenderError field="name" />

      <Spacer size={10} />

      <Input label="Description" {...form.getFieldProps('description')} />

      <Spacer size={10} />

      {hasAuthMethods ? (
        <Select
          label="Authentication Method"
          value={form.values.authMethodId}
          placeholder="Select an authentication method..."
          onChange={handleAuthMethodChange}
          items={authMethodItems}
        />
      ) : (
        <Text size="2" color="gray600">
          No auth methods found for this provider.
        </Text>
      )}
      <form.RenderError field="authMethodId" />

      {selectedMethod?.description && (
        <>
          <Spacer size={5} />
          <Text size="1" color="gray600">
            {selectedMethod.description}
          </Text>
        </>
      )}

      <Spacer size={10} />

      {form.values.authMethodId && credentialsSection}

      <Spacer size={15} />

      <Dialog.Actions>
        <Button variant="outline" onClick={props.close}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          loading={createMutation.isPending}
          disabled={!form.values.authMethodId}
        >
          Update
        </Button>
      </Dialog.Actions>

      <createMutation.RenderError />
    </form>
  );
};
