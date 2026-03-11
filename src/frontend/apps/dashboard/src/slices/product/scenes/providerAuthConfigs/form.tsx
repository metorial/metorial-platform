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
import { useEffect, useState } from 'react';
import { getJsonSchemaObject } from '../../lib/jsonSchema';
import { getProviderOAuthAutoRegistrationEnabled } from '../../lib/providerOAuthAutoRegistration';
import { JsonSchemaInput } from '../jsonSchemaInput';
import { ProviderContextCard } from '../providerContextCard';
import { Stepper } from '../stepper';

type AuthMethod = DashboardInstanceProvidersAuthMethodsListOutput['items'][number];

let getAuthMethodHasSchema = (method: AuthMethod | undefined) => {
  let schemaObj = getJsonSchemaObject(method?.inputSchema);

  return !!(
    schemaObj &&
    typeof schemaObj === 'object' &&
    schemaObj.type === 'object' &&
    schemaObj.properties &&
    Object.keys(schemaObj.properties).length > 0
  );
};

export type ProviderAuthConfigFormProps =
  | {
      type: 'create';
      providerDeploymentId?: string;
      providerId?: string;
      instanceId?: string;
      initialAuthMethodId?: string;
      hideAuthMethodStep?: boolean;
      showAuthMethodStepInStepper?: boolean;
    }
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

  let deployment =
    props.type === 'create'
      ? useProviderDeployment(instanceId, props.providerDeploymentId)
      : useProviderDeployment(instanceId, props.providerDeploymentId);
  let resolvedProviderId =
    props.type === 'create'
      ? props.providerId ?? deployment.data?.providerId
      : deployment.data?.providerId;
  let provider = useProvider(instanceId, resolvedProviderId);
  let effectiveVersionId =
    deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id;
  let oauthAutoRegistrationEnabled = getProviderOAuthAutoRegistrationEnabled(provider.data);

  let authMethods = useProviderAuthMethods(instanceId, effectiveVersionId);
  let manualAuthMethods = (authMethods.data?.items ?? []).filter((method: AuthMethod) => {
    if (method.type !== 'oauth') return true;
    return getAuthMethodHasSchema(method);
  });

  let [credentialsData, setCredentialsData] = useState<Record<string, unknown>>({});
  let [step, setStep] = useState(
    props.type === 'create' &&
      !!props.hideAuthMethodStep &&
      !!props.showAuthMethodStepInStepper
      ? 1
      : 0
  );

  let form = useForm({
    initialValues: {
      name: '',
      description: '',
      authMethodId: props.type === 'create' ? props.initialAuthMethodId ?? '' : '',
      credentialsDataJson: '{}'
    },
    onSubmit: async values => {
      form.setFieldTouched('authMethodId', true, false);
      await form.validateField('authMethodId');

      if (!values.authMethodId) return;

      let parsedCredentials: Record<string, unknown> = {};
      if (hasSchema) {
        parsedCredentials = credentialsData;
      } else if (isOAuthWithoutSchema) {
        parsedCredentials = {};
      } else {
        form.setFieldTouched('credentialsDataJson', true, false);
        await form.validateField('credentialsDataJson');

        try {
          parsedCredentials = JSON.parse(values.credentialsDataJson);
        } catch {
          form.setFieldError('credentialsDataJson', 'Credentials data must be valid JSON');
          return;
        }
      }

      if (props.type !== 'create' || !instanceId) return;

      let [result] = await createMutation.mutate({
        instanceId,
        ...(props.providerDeploymentId
          ? { providerDeploymentId: props.providerDeploymentId }
          : {}),
        name: values.name.trim(),
        description: values.description || undefined,
        providerAuthMethodId: values.authMethodId,
        value: parsedCredentials
      });

      if (!result) return;

      props.onCreate?.(result);
      props.close?.();
    },
    schemaDependencies: [authMethods.data?.items, oauthAutoRegistrationEnabled],
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string().defined(),
        authMethodId: yup.string().required('Authentication method is required'),
        credentialsDataJson: yup
          .string()
          .defined()
          .test('valid-json', 'Credentials data must be valid JSON', function (value) {
            let authMethodId = this.parent.authMethodId;
            let selectedMethod = manualAuthMethods.find(
              (method: AuthMethod) => method.id === authMethodId
            );

            let hasSchema = getAuthMethodHasSchema(selectedMethod);
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

  let selectedMethod = manualAuthMethods.find(
    (method: AuthMethod) => method.id === form.values.authMethodId
  );

  let schemaObj = getJsonSchemaObject(selectedMethod?.inputSchema);
  let hasSchema = getAuthMethodHasSchema(selectedMethod);
  let isOAuthWithoutSchema =
    !!form.values.authMethodId &&
    selectedMethod?.type === 'oauth' &&
    !hasSchema &&
    oauthAutoRegistrationEnabled;

  if ((props.providerDeploymentId && deployment.isLoading) || authMethods.isLoading) {
    return <CenteredSpinner />;
  }

  let authMethodItems = manualAuthMethods.map((method: AuthMethod) => ({
    id: method.id,
    label: method.name
  }));
  let hasAuthMethods = authMethodItems.length > 0;
  let hasSingleMethod = authMethodItems.length === 1;
  let singleMethodId = manualAuthMethods[0]?.id ?? '';
  let initialAuthMethodId = props.type === 'create' ? props.initialAuthMethodId : undefined;
  let skipAuthMethodStep = props.type === 'create' && !!props.hideAuthMethodStep;
  let showHiddenAuthMethodStep =
    props.type === 'create' &&
    !!props.hideAuthMethodStep &&
    !!props.showAuthMethodStepInStepper;
  let includeAuthMethodStep = (!hasSingleMethod && !skipAuthMethodStep) || showHiddenAuthMethodStep;

  let resetCredentials = () => {
    setCredentialsData({});
    form.setFieldValue('credentialsDataJson', '{}');
    form.setFieldTouched('credentialsDataJson', false, false);
    form.setFieldError('credentialsDataJson', undefined);
  };

  useEffect(() => {
    if (!form.values.authMethodId && hasSingleMethod && singleMethodId) {
      form.setFieldValue('authMethodId', singleMethodId);
    }
  }, [form.values.authMethodId, hasSingleMethod, singleMethodId]);

  useEffect(() => {
    if (!initialAuthMethodId) return;
    if (form.values.authMethodId) return;
    form.setFieldValue('authMethodId', initialAuthMethodId);
  }, [initialAuthMethodId, form.values.authMethodId]);

  useEffect(() => {
    if (!form.values.authMethodId) return;
    if (manualAuthMethods.some(method => method.id === form.values.authMethodId)) return;
    form.setFieldValue('authMethodId', '');
    resetCredentials();
  }, [form.values.authMethodId, manualAuthMethods]);

  let handleAuthMethodChange = (value: string) => {
    form.setFieldValue('authMethodId', value);
    resetCredentials();
  };

  let credentialsSection = hasSchema ? (
    <JsonSchemaInput
      schema={schemaObj}
      value={credentialsData}
      onChange={setCredentialsData}
      variant="raw"
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

  let providerContext = resolvedProviderId ? (
    <>
      <ProviderContextCard
        providerId={resolvedProviderId}
        providerName={provider.data?.name ?? resolvedProviderId}
        providerImageUrl={provider.data?.publisher.imageUrl}
        deploymentName={deployment.data?.name}
        deploymentDescription={deployment.data?.description}
      />

      <Spacer size={10} />
    </>
  ) : null;

  if (props.type === 'create') {
    let credentialsStepIndex = includeAuthMethodStep ? 1 : 0;
    let detailsStepIndex = includeAuthMethodStep ? 2 : 1;

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
              Configuring <strong>{selectedMethod.name}</strong>
            </Text>
          )}

          <Spacer size={10} />

          {credentialsSection}

          <Spacer size={15} />

          <Dialog.Actions>
            {!hasSingleMethod && !skipAuthMethodStep && (
              <Button variant="outline" onClick={() => setStep(0)}>
                Back
              </Button>
            )}
            {(hasSingleMethod || skipAuthMethodStep) && (
              <Button variant="outline" onClick={props.onBack ?? props.close}>
                {props.onBack ? 'Back' : 'Cancel'}
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
        <form onSubmit={form.handleSubmit}>
          <Input label="Name" required {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={10} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer size={15} />

          <Dialog.Actions>
            <Button type="button" variant="outline" onClick={() => setStep(credentialsStepIndex)}>
              Back
            </Button>
            <Button
              type="submit"
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

    let steps = includeAuthMethodStep
      ? [methodStep, credentialsStep, detailsStep]
      : [credentialsStep, detailsStep];

    let handleStepChange = (nextStep: number) => {
      if (showHiddenAuthMethodStep && nextStep === 0) {
        props.onBack?.();
        return;
      }

      setStep(nextStep);
    };

    return (
      <>
        {providerContext}

        <Stepper
          steps={steps}
          currentStep={step}
          setCurrentStep={handleStepChange}
        />
      </>
    );
  }

  return (
    <>
      {providerContext}

      <form onSubmit={form.handleSubmit}>
        <Input label="Name" required {...form.getFieldProps('name')} />
        <form.RenderError field="name" />

        <Spacer size={10} />

        <Input label="Description" {...form.getFieldProps('description')} />
        <form.RenderError field="description" />

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
          <Button type="button" variant="outline" onClick={props.close}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={createMutation.isPending}
            disabled={!form.values.authMethodId}
          >
            Update
          </Button>
        </Dialog.Actions>

        <createMutation.RenderError />
      </form>
    </>
  );
};
