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
import { JsonSchemaInput } from '../jsonSchemaInput';
import { Stepper } from '../stepper';

type AuthMethod = {
  id: string;
  type: 'oauth' | 'token' | 'custom';
  name: string;
  description: string | null;
  inputSchema: Record<string, any> | null;
};

export type ProviderAuthConfigFormProps =
  | { type: 'create'; providerDeploymentId: string }
  | { type: 'update'; providerDeploymentId: string; authConfigId: string };

export let ProviderAuthConfigForm = (
  props: ProviderAuthConfigFormProps & {
    close?: () => void;
    onCreate?: (authConfig: any) => void;
    onBack?: () => void;
  }
) => {
  let instance = useCurrentInstance();
  let createMutation = useCreateProviderAuthConfig();

  let deployment = useProviderDeployment(instance.data?.id, props.providerDeploymentId);
  let provider = useProvider(instance.data?.id, deployment.data?.providerId);
  let effectiveVersionId =
    deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id;

  let authMethods = useProviderAuthMethods(instance.data?.id, effectiveVersionId);

  let [name, setName] = useState('');
  let [description, setDescription] = useState('');
  let [authMethodId, setAuthMethodId] = useState('');
  let [credentialsData, setCredentialsData] = useState<Record<string, any>>({});
  let [credentialsDataJson, setCredentialsDataJson] = useState('{}');
  let [oauthClientId, setOauthClientId] = useState('');
  let [oauthClientSecret, setOauthClientSecret] = useState('');
  let [step, setStep] = useState(0);
  let [submitError, setSubmitError] = useState<string | null>(null);

  // Find the selected auth method
  let selectedMethod = authMethods.data?.items?.find(
    (m: AuthMethod) => m.id === authMethodId
  ) as AuthMethod | undefined;

  // Check if selected method has a non-empty input schema
  let schemaObj = selectedMethod?.inputSchema;
  let hasSchema =
    schemaObj &&
    typeof schemaObj === 'object' &&
    schemaObj.type === 'object' &&
    schemaObj.properties &&
    Object.keys(schemaObj.properties).length > 0;
  let isOAuthWithoutSchema = !!authMethodId && selectedMethod?.type === 'oauth' && !hasSchema;

  let handleSubmit = async () => {
    if (!instance.data) return;
    setSubmitError(null);

    if (props.type === 'create') {
      let parsedCredentials: Record<string, any> = {};

      if (hasSchema) {
        // Use structured credentials from JsonSchemaInput
        parsedCredentials = credentialsData;
      } else if (isOAuthWithoutSchema) {
        // OAuth methods with no input schema should use the OAuth setup flow instead
        parsedCredentials = {};
      } else {
        // Parse from JSON textarea
        try {
          parsedCredentials = JSON.parse(credentialsDataJson);
        } catch (e) {
          return;
        }
      }

      let [result, err] = await createMutation.mutate({
        instanceId: instance.data.id,
        providerDeploymentId: props.providerDeploymentId,
        name,
        description: description || undefined,
        providerAuthMethodId: authMethodId,
        value: parsedCredentials
      });

      if (err) {
        setSubmitError(
          err.data?.message ??
            'Failed to create auth config. Please check the inputs and try again.'
        );
      } else if (result) {
        props.onCreate?.(result);
        props.close?.();
      }
    }
  };

  if (deployment.isLoading || authMethods.isLoading) {
    return <CenteredSpinner />;
  }

  let authMethodItems = (authMethods.data?.items ?? []).map((method: AuthMethod) => ({
    id: method.id,
    label: `${method.name} (${method.type})`
  }));
  let hasAuthMethods = authMethodItems.length > 0;
  let hasSingleMethod = authMethodItems.length === 1;

  useEffect(() => {
    if (!authMethodId && hasSingleMethod) {
      setAuthMethodId(authMethods.data!.items![0].id);
    }
  }, [authMethods.data?.items, hasSingleMethod, authMethodId]);

  let credentialsSection = hasSchema ? (
    <JsonSchemaInput
      schema={selectedMethod!.inputSchema as JSONSchema7}
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
    <Input
      label="Credentials Data (JSON)"
      value={credentialsDataJson}
      onChange={e => setCredentialsDataJson(e.target.value)}
      as="textarea"
      minRows={5}
      style={{ fontFamily: 'monospace' }}
    />
  );

  if (props.type === 'create') {
    let methodStep = {
      title: 'Authentication',
      subtitle: 'Select auth method',
      render: () => (
        <>
          {hasAuthMethods ? (
            <Select
              label="Authentication Method"
              value={authMethodId}
              placeholder="Select an authentication method..."
              onChange={value => {
                setAuthMethodId(value);
                setCredentialsData({});
                setCredentialsDataJson('{}');
                setOauthClientId('');
                setOauthClientSecret('');
              }}
              items={authMethodItems}
            />
          ) : (
            <Text size="2" color="gray600">
              No auth methods found for this provider.
            </Text>
          )}

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
                <Button onClick={() => setStep(1)} disabled={!authMethodId}>
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

    let credentialsStepIndex = hasSingleMethod ? 0 : 1;
    let detailsStepIndex = hasSingleMethod ? 1 : 2;

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
            <Button onClick={() => setStep(detailsStepIndex)}>
              Continue
            </Button>
          </Dialog.Actions>
        </>
      )
    };

    let detailsStep = {
      title: 'Details',
      subtitle: 'Name and create',
      render: () => (
        <>
          <Input
            label="Name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />

          <Spacer size={10} />

          <Input
            label="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />

          <Spacer size={15} />

          <Dialog.Actions>
            <Button variant="outline" onClick={() => setStep(credentialsStepIndex)}>
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              loading={createMutation.isPending}
              disabled={!name || !authMethodId}
            >
              Create
            </Button>
          </Dialog.Actions>
          {submitError && (
            <>
              <Spacer size={8} />
              <Text size="2" color="red500">
                {submitError}
              </Text>
            </>
          )}
        </>
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
    <>
      <Input label="Name" value={name} onChange={e => setName(e.target.value)} required />

      <Spacer size={10} />

      <Input
        label="Description"
        value={description}
        onChange={e => setDescription(e.target.value)}
      />

      <Spacer size={10} />

      {hasAuthMethods ? (
        <Select
          label="Authentication Method"
          value={authMethodId}
          placeholder="Select an authentication method..."
          onChange={value => {
            setAuthMethodId(value);
            setCredentialsData({});
            setCredentialsDataJson('{}');
            setOauthClientId('');
            setOauthClientSecret('');
          }}
          items={authMethodItems}
        />
      ) : (
        <Text size="2" color="gray600">
          No auth methods found for this provider.
        </Text>
      )}

      {selectedMethod?.description && (
        <>
          <Spacer size={5} />
          <Text size="1" color="gray600">
            {selectedMethod.description}
          </Text>
        </>
      )}

      <Spacer size={10} />

      {authMethodId && credentialsSection}

      <Spacer size={15} />

      <Dialog.Actions>
        <Button variant="outline" onClick={props.close}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          loading={createMutation.isPending}
          disabled={!name || !authMethodId}
        >
          Update
        </Button>
      </Dialog.Actions>
    </>
  );
};
